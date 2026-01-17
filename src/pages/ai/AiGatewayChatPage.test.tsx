import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AiGatewayChatPage from './AiGatewayChatPage';

describe('AiGatewayChatPage', () => {
  beforeEach(() => {
    vi.stubGlobal('crypto', {
      randomUUID: () => 'test-uuid-' + Math.random().toString(36).slice(2),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('rendering', () => {
    it('should render the page title', () => {
      render(<AiGatewayChatPage />);
      expect(screen.getByText('AI Gateway Chat')).toBeInTheDocument();
    });

    it('should render model selectors for all three providers', () => {
      render(<AiGatewayChatPage />);

      expect(screen.getByLabelText('OpenAI')).toBeInTheDocument();
      expect(screen.getByLabelText('Anthropic')).toBeInTheDocument();
      expect(screen.getByLabelText('Google')).toBeInTheDocument();
    });

    it('should render default model selections', () => {
      render(<AiGatewayChatPage />);

      expect(screen.getByLabelText('OpenAI')).toHaveValue('gpt-4o-mini');
      expect(screen.getByLabelText('Anthropic')).toHaveValue('claude-3-haiku-20240307');
      expect(screen.getByLabelText('Google')).toHaveValue('gemini-2.0-flash');
    });

    it('should render empty state message', () => {
      render(<AiGatewayChatPage />);
      expect(
        screen.getByText('Ask a question to get responses from AI providers')
      ).toBeInTheDocument();
    });

    it('should render input field and send button', () => {
      render(<AiGatewayChatPage />);

      expect(screen.getByPlaceholderText('Ask a question...')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument();
    });
  });

  describe('model selection', () => {
    it('should allow changing OpenAI model', async () => {
      const user = userEvent.setup();
      render(<AiGatewayChatPage />);

      const openaiSelect = screen.getByLabelText('OpenAI');
      await user.selectOptions(openaiSelect, 'gpt-4o');

      expect(openaiSelect).toHaveValue('gpt-4o');
    });

    it('should allow changing Anthropic model', async () => {
      const user = userEvent.setup();
      render(<AiGatewayChatPage />);

      const anthropicSelect = screen.getByLabelText('Anthropic');
      await user.selectOptions(anthropicSelect, 'claude-3-5-haiku-20241022');

      expect(anthropicSelect).toHaveValue('claude-3-5-haiku-20241022');
    });

    it('should allow changing Google model', async () => {
      const user = userEvent.setup();
      render(<AiGatewayChatPage />);

      const googleSelect = screen.getByLabelText('Google');
      await user.selectOptions(googleSelect, 'gemini-2.5-pro');

      expect(googleSelect).toHaveValue('gemini-2.5-pro');
    });
  });

  describe('form submission', () => {
    it('should disable send button when input is empty', () => {
      render(<AiGatewayChatPage />);

      const sendButton = screen.getByRole('button', { name: /send/i });
      expect(sendButton).toBeDisabled();
    });

    it('should enable send button when input has text', async () => {
      const user = userEvent.setup();
      render(<AiGatewayChatPage />);

      const input = screen.getByPlaceholderText('Ask a question...');
      await user.type(input, 'Hello');

      const sendButton = screen.getByRole('button', { name: /send/i });
      expect(sendButton).toBeEnabled();
    });

    it('should submit message and show user message', async () => {
      const user = userEvent.setup();

      global.fetch = vi.fn().mockResolvedValue({
        json: () =>
          Promise.resolve({
            success: true,
            results: {
              openai: { ok: true, text: 'OpenAI response' },
              anthropic: { ok: true, text: 'Anthropic response' },
              gemini: { ok: true, text: 'Gemini response' },
            },
          }),
      });

      render(<AiGatewayChatPage />);

      const input = screen.getByPlaceholderText('Ask a question...');
      await user.type(input, 'Hello AI');
      await user.click(screen.getByRole('button', { name: /send/i }));

      expect(screen.getByText('Hello AI')).toBeInTheDocument();
    });

    it('should clear input after submission', async () => {
      const user = userEvent.setup();

      global.fetch = vi.fn().mockResolvedValue({
        json: () =>
          Promise.resolve({
            success: true,
            results: {
              openai: { ok: true, text: 'Response' },
              anthropic: { ok: true, text: 'Response' },
              gemini: { ok: true, text: 'Response' },
            },
          }),
      });

      render(<AiGatewayChatPage />);

      const input = screen.getByPlaceholderText('Ask a question...');
      await user.type(input, 'Hello AI');
      await user.click(screen.getByRole('button', { name: /send/i }));

      expect(input).toHaveValue('');
    });

    it('should show loading state during submission', async () => {
      const user = userEvent.setup();

      global.fetch = vi.fn().mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  json: () =>
                    Promise.resolve({
                      success: true,
                      results: {
                        openai: { ok: true, text: 'Response' },
                        anthropic: { ok: true, text: 'Response' },
                        gemini: { ok: true, text: 'Response' },
                      },
                    }),
                }),
              100
            )
          )
      );

      render(<AiGatewayChatPage />);

      const input = screen.getByPlaceholderText('Ask a question...');
      await user.type(input, 'Hello AI');
      await user.click(screen.getByRole('button', { name: /send/i }));

      expect(screen.getByText('Getting responses from AI providers...')).toBeInTheDocument();
    });

    it('should send correct request body with selected models', async () => {
      const user = userEvent.setup();

      global.fetch = vi.fn().mockResolvedValue({
        json: () =>
          Promise.resolve({
            success: true,
            results: {
              openai: { ok: true, text: 'Response' },
              anthropic: { ok: true, text: 'Response' },
              gemini: { ok: true, text: 'Response' },
            },
          }),
      });

      render(<AiGatewayChatPage />);

      const input = screen.getByPlaceholderText('Ask a question...');
      await user.type(input, 'Test message');
      await user.click(screen.getByRole('button', { name: /send/i }));

      expect(global.fetch).toHaveBeenCalledWith('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Test message',
          models: {
            openai: 'gpt-4o-mini',
            anthropic: 'claude-3-haiku-20240307',
            gemini: 'gemini-2.0-flash',
          },
        }),
      });
    });
  });

  describe('response display', () => {
    it('should display successful responses from all providers', async () => {
      const user = userEvent.setup();

      global.fetch = vi.fn().mockResolvedValue({
        json: () =>
          Promise.resolve({
            success: true,
            results: {
              openai: { ok: true, text: 'OpenAI says hello' },
              anthropic: { ok: true, text: 'Anthropic says hello' },
              gemini: { ok: true, text: 'Gemini says hello' },
            },
          }),
      });

      render(<AiGatewayChatPage />);

      const input = screen.getByPlaceholderText('Ask a question...');
      await user.type(input, 'Hello');
      await user.click(screen.getByRole('button', { name: /send/i }));

      await waitFor(() => {
        expect(screen.getByText('OpenAI says hello')).toBeInTheDocument();
        expect(screen.getByText('Anthropic says hello')).toBeInTheDocument();
        expect(screen.getByText('Gemini says hello')).toBeInTheDocument();
      });
    });

    it('should display error messages for failed providers', async () => {
      const user = userEvent.setup();

      global.fetch = vi.fn().mockResolvedValue({
        json: () =>
          Promise.resolve({
            success: true,
            results: {
              openai: { ok: true, text: 'OpenAI response' },
              anthropic: { ok: false, error: 'Anthropic rate limited' },
              gemini: { ok: true, text: 'Gemini response' },
            },
          }),
      });

      render(<AiGatewayChatPage />);

      const input = screen.getByPlaceholderText('Ask a question...');
      await user.type(input, 'Hello');
      await user.click(screen.getByRole('button', { name: /send/i }));

      await waitFor(() => {
        expect(screen.getByText('OpenAI response')).toBeInTheDocument();
        expect(screen.getByText('Error: Anthropic rate limited')).toBeInTheDocument();
        expect(screen.getByText('Gemini response')).toBeInTheDocument();
      });
    });

    it('should display provider labels in response cards', async () => {
      const user = userEvent.setup();

      global.fetch = vi.fn().mockResolvedValue({
        json: () =>
          Promise.resolve({
            success: true,
            results: {
              openai: { ok: true, text: 'Response' },
              anthropic: { ok: true, text: 'Response' },
              gemini: { ok: true, text: 'Response' },
            },
          }),
      });

      render(<AiGatewayChatPage />);

      const input = screen.getByPlaceholderText('Ask a question...');
      await user.type(input, 'Hello');
      await user.click(screen.getByRole('button', { name: /send/i }));

      await waitFor(() => {
        const headings = screen.getAllByRole('heading', { level: 3 });
        expect(headings.map((h) => h.textContent)).toEqual(
          expect.arrayContaining(['OpenAI', 'Anthropic', 'Google'])
        );
      });
    });
  });

  describe('error handling', () => {
    it('should display error message on network failure', async () => {
      const user = userEvent.setup();

      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      render(<AiGatewayChatPage />);

      const input = screen.getByPlaceholderText('Ask a question...');
      await user.type(input, 'Hello');
      await user.click(screen.getByRole('button', { name: /send/i }));

      await waitFor(() => {
        expect(
          screen.getByText('Failed to connect to the AI service. Please try again.')
        ).toBeInTheDocument();
      });
    });

    it('should display error message on API error response', async () => {
      const user = userEvent.setup();

      global.fetch = vi.fn().mockResolvedValue({
        json: () =>
          Promise.resolve({
            success: false,
            error: 'Internal server error',
          }),
      });

      render(<AiGatewayChatPage />);

      const input = screen.getByPlaceholderText('Ask a question...');
      await user.type(input, 'Hello');
      await user.click(screen.getByRole('button', { name: /send/i }));

      await waitFor(() => {
        expect(screen.getByText('Internal server error')).toBeInTheDocument();
      });
    });
  });

  describe('accessibility', () => {
    it('should have accessible form controls', () => {
      render(<AiGatewayChatPage />);

      expect(screen.getByLabelText('OpenAI')).toBeInTheDocument();
      expect(screen.getByLabelText('Anthropic')).toBeInTheDocument();
      expect(screen.getByLabelText('Google')).toBeInTheDocument();
    });

    it('should have accessible input field', () => {
      render(<AiGatewayChatPage />);

      const input = screen.getByPlaceholderText('Ask a question...');
      expect(input).toHaveAttribute('type', 'text');
    });
  });
});
