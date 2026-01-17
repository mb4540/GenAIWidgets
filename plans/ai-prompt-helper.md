# AI Prompt Helper for Agent Creation

## Overview
Add an AI-powered "Build Prompt With AI" button to the Create New Agent modal that generates a system prompt based on the agent's Name, Description, and Goal fields.

## Requirements

### Prerequisites for Button Activation
- **Name** field must be populated (required)
- **Description** field must be populated (make required)
- **Goal** field must be populated (required)
- Button is disabled until all three fields have content

### User Flow
1. User fills in Name, Description, and Goal fields
2. "Build Prompt With AI" button becomes enabled
3. User clicks button
4. Loading state shown while AI generates prompt
5. Generated prompt populates the System Prompt textarea
6. User can edit the prompt or accept as-is
7. User clicks "Create Agent"

---

## Implementation Plan

### Phase 1: Backend - Create LLM Prompt for System Prompt Generation

**Task 1.1: Create Admin Prompt Entry via Admin Dashboard UI**
- Navigate to Admin Dashboard → Prompts tab
- Click "Add Prompt" or create new prompt
- Fill in fields using the existing Edit Prompt modal:
  - `Function Name`: `generate_agent_prompt`
  - `Display Name`: `Agent Prompt Generator`
  - `Description`: `Generates system prompts for agents based on name, description, and goal`
  - `Model Provider`: Select from dropdown (e.g., Anthropic)
  - `Model`: Select from model dropdown (e.g., Claude Opus 4.5)
  - `Temperature`: 0.7
  - `Max Tokens`: 2048
  - `System Prompt`: (see detailed prompt below)
  - `User Prompt Template`: `{{user_message}}`
  - `Active`: checked

**Task 1.2: Create Netlify Function**
- Create `/netlify/functions/generate-agent-prompt.ts`
- Accept POST with `{ name, description, goal }`
- Fetch prompt from `prompts` table by `function_name`
- Call AI Gateway with the prompt and user inputs
- Return generated system prompt

**Task 1.3: Add API Route**
- Add redirect in `netlify.toml`:
  ```toml
  [[redirects]]
    from = "/api/generate-agent-prompt"
    to = "/.netlify/functions/generate-agent-prompt"
    status = 200
  ```

### Phase 2: Frontend - Update AgentForm Component

**Task 2.1: Update Form Validation**
- Make Description field required (currently optional)
- Add validation state tracking for Name, Description, Goal

**Task 2.2: Add "Build Prompt With AI" Button**
- Position button next to "System Prompt *" label
- Use Sparkles or Wand2 icon from Lucide
- Disabled state when prerequisites not met
- Loading state with spinner during generation

**Task 2.3: Implement Generation Logic**
- Call `/api/generate-agent-prompt` endpoint
- Handle loading/error states
- Populate System Prompt textarea with result
- Show toast notification on success/error

---

## Technical Details

### System Prompt for Agent Prompt Generator

**System Prompt** (paste into Admin Dashboard):
```
You are an expert at creating system prompts for AI agents. Your task is to generate a comprehensive, effective system prompt based on the provided agent details.

Generate a system prompt that:
1. Clearly defines the agent's role and personality based on the name
2. Incorporates the description to establish capabilities and context
3. Focuses on achieving the stated goal
4. Provides guidelines for how the agent should respond
5. Sets appropriate tone and communication style

The system prompt should be:
- Clear and unambiguous
- Professional yet approachable
- Focused on the stated goal
- Between 200-400 words
- Written in second person ("You are...")

Output ONLY the system prompt text, no explanations, headers, or metadata.
```

**User Prompt Template** (paste into Admin Dashboard):
```
Create a system prompt for an AI agent with these details:

Name: {{name}}
Description: {{description}}
Goal: {{goal}}
```

### API Request/Response

**Request:**
```json
POST /api/generate-agent-prompt
{
  "name": "Customer Support Agent",
  "description": "Handles customer inquiries and support tickets",
  "goal": "Resolve customer issues efficiently while maintaining satisfaction"
}
```

**Response:**
```json
{
  "success": true,
  "prompt": "You are a Customer Support Agent..."
}
```

---

## Files to Modify/Create

### New Files
- `/netlify/functions/generate-agent-prompt.ts`

### Modified Files
- `/netlify.toml` - Add API redirect
- `/src/pages/agent-chat/components/AgentForm.tsx` - Add button and logic

### Database
- Insert new row in `prompts` table

---

## Testing Checklist
- [ ] Button disabled when Name/Description/Goal empty
- [ ] Button enabled when all fields populated
- [ ] Loading state shows during generation
- [ ] Generated prompt populates textarea
- [ ] User can edit generated prompt
- [ ] Error handling for API failures
- [ ] Works in both create and edit modes (edit mode may skip this feature)

---

## Estimated Effort
- Backend: 1 hour
- Frontend: 1 hour
- Testing: 30 minutes
- **Total: ~2.5 hours**
