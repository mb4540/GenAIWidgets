import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSql = vi.fn();

vi.mock('@neondatabase/serverless', () => ({
  neon: () => mockSql,
}));

vi.mock('jsonwebtoken', () => ({
  default: {
    verify: vi.fn(() => ({ userId: 'test-user-id', email: 'test@example.com', tenantId: 'test-tenant-id' })),
    JsonWebTokenError: class JsonWebTokenError extends Error {},
  },
}));

import handler from '../../../netlify/functions/agents';

const createMockRequest = (method: string, body?: unknown, searchParams?: Record<string, string>): Request => {
  const url = new URL('http://localhost/.netlify/functions/agents');
  if (searchParams) {
    Object.entries(searchParams).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
  }
  return new Request(url.toString(), {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer valid-token',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
};

const mockContext = {} as Parameters<typeof handler>[1];

const mockAgent = {
  agent_id: 'agent-1',
  tenant_id: 'test-tenant-id',
  user_id: 'test-user-id',
  name: 'Test Agent',
  description: 'A test agent',
  goal: 'Help users with testing',
  system_prompt: 'You are a helpful test assistant.',
  model_provider: 'openai',
  model_name: 'gpt-4o',
  max_steps: 10,
  temperature: '0.70',
  is_active: true,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

const validAgentInput = {
  name: 'Test Agent',
  goal: 'Help users with testing',
  system_prompt: 'You are a helpful test assistant.',
  model_provider: 'openai',
  model_name: 'gpt-4o',
};

describe('agents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DATABASE_URL = 'postgres://test';
    process.env.JWT_SECRET = 'test-secret';
  });

  describe('authentication', () => {
    it('should return 401 when no authorization header', async () => {
      const req = new Request('http://localhost/.netlify/functions/agents', {
        method: 'GET',
      });

      const response = await handler(req, mockContext);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Unauthorized');
    });
  });

  describe('GET /agents', () => {
    it('should return list of agents for tenant', async () => {
      mockSql
        .mockResolvedValueOnce([{ is_admin: false }])
        .mockResolvedValueOnce([mockAgent]);

      const req = createMockRequest('GET');
      const response = await handler(req, mockContext);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.agents).toHaveLength(1);
      expect(data.agents[0].name).toBe('Test Agent');
    });

    it('should return single agent by id', async () => {
      mockSql
        .mockResolvedValueOnce([{ is_admin: false }])
        .mockResolvedValueOnce([mockAgent]);

      const req = createMockRequest('GET', undefined, { id: 'agent-1' });
      const response = await handler(req, mockContext);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.agent.name).toBe('Test Agent');
    });

    it('should return 404 when agent not found', async () => {
      mockSql
        .mockResolvedValueOnce([{ is_admin: false }])
        .mockResolvedValueOnce([]);

      const req = createMockRequest('GET', undefined, { id: 'nonexistent' });
      const response = await handler(req, mockContext);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Agent not found');
    });
  });

  describe('POST /agents', () => {
    it('should create a new agent', async () => {
      mockSql
        .mockResolvedValueOnce([{ is_admin: false }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([mockAgent]);

      const req = createMockRequest('POST', validAgentInput);
      const response = await handler(req, mockContext);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.agent.name).toBe('Test Agent');
    });

    it('should return 400 when name is missing', async () => {
      mockSql.mockResolvedValueOnce([{ is_admin: false }]);

      const req = createMockRequest('POST', { ...validAgentInput, name: '' });
      const response = await handler(req, mockContext);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Agent name is required');
    });

    it('should return 400 when goal is missing', async () => {
      mockSql.mockResolvedValueOnce([{ is_admin: false }]);

      const req = createMockRequest('POST', { ...validAgentInput, goal: '' });
      const response = await handler(req, mockContext);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Agent goal is required');
    });

    it('should return 400 when model_provider is invalid', async () => {
      mockSql.mockResolvedValueOnce([{ is_admin: false }]);

      const req = createMockRequest('POST', { ...validAgentInput, model_provider: 'invalid' });
      const response = await handler(req, mockContext);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Invalid model provider');
    });

    it('should return 409 when agent name already exists', async () => {
      mockSql
        .mockResolvedValueOnce([{ is_admin: false }])
        .mockResolvedValueOnce([{ agent_id: 'existing-id' }]);

      const req = createMockRequest('POST', validAgentInput);
      const response = await handler(req, mockContext);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.success).toBe(false);
      expect(data.error).toBe('An agent with this name already exists');
    });
  });

  describe('PUT /agents', () => {
    it('should update an existing agent', async () => {
      const updatedAgent = { ...mockAgent, name: 'Updated Agent' };
      mockSql
        .mockResolvedValueOnce([{ is_admin: false }])
        .mockResolvedValueOnce([mockAgent])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([updatedAgent]);

      const req = createMockRequest('PUT', { ...validAgentInput, name: 'Updated Agent' }, { id: 'agent-1' });
      const response = await handler(req, mockContext);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.agent.name).toBe('Updated Agent');
    });

    it('should return 400 when id is missing', async () => {
      mockSql.mockResolvedValueOnce([{ is_admin: false }]);

      const req = createMockRequest('PUT', validAgentInput);
      const response = await handler(req, mockContext);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Agent ID required');
    });

    it('should return 404 when agent not found', async () => {
      mockSql
        .mockResolvedValueOnce([{ is_admin: false }])
        .mockResolvedValueOnce([]);

      const req = createMockRequest('PUT', validAgentInput, { id: 'nonexistent' });
      const response = await handler(req, mockContext);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Agent not found');
    });
  });

  describe('DELETE /agents', () => {
    it('should delete an existing agent', async () => {
      mockSql
        .mockResolvedValueOnce([{ is_admin: false }])
        .mockResolvedValueOnce([{ agent_id: 'agent-1' }]);

      const req = createMockRequest('DELETE', undefined, { id: 'agent-1' });
      const response = await handler(req, mockContext);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.deleted).toBe(true);
    });

    it('should return 400 when id is missing', async () => {
      mockSql.mockResolvedValueOnce([{ is_admin: false }]);

      const req = createMockRequest('DELETE');
      const response = await handler(req, mockContext);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Agent ID required');
    });

    it('should return 404 when agent not found', async () => {
      mockSql
        .mockResolvedValueOnce([{ is_admin: false }])
        .mockResolvedValueOnce([]);

      const req = createMockRequest('DELETE', undefined, { id: 'nonexistent' });
      const response = await handler(req, mockContext);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Agent not found');
    });
  });

  describe('unsupported methods', () => {
    it('should return 405 for unsupported methods', async () => {
      mockSql.mockResolvedValueOnce([{ is_admin: false }]);

      const req = createMockRequest('PATCH');
      const response = await handler(req, mockContext);
      const data = await response.json();

      expect(response.status).toBe(405);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Method not allowed');
    });
  });
});
