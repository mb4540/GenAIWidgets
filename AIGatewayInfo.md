Prompt
when I use the AI gateway will it work on local host without API keys?


Claude Agent took 1m 26s
Result
The Netlify AI Gateway does not work on localhost without additional setup. Here's what you need to know:

How the AI Gateway Works
When deployed to Netlify, the AI Gateway automatically injects API keys in Netlify compute environments (Functions, Edge Functions). You don't need to configure any API keys yourself—Netlify handles authentication and billing based on token usage.

These environment variables are automatically available in production:

OPENAI_API_KEY / OPENAI_BASE_URL
ANTHROPIC_API_KEY / ANTHROPIC_BASE_URL
GEMINI_API_KEY / GOOGLE_GEMINI_BASE_URL
Local Development Options
For local development, you have three options:

| Option | How to Use | API Keys Needed? | |--------|------------|------------------| | netlify dev | Run netlify dev instead of npm run dev | No (uses Netlify's injected keys) | | @netlify/vite-plugin | Install and configure the Vite plugin | No (enables local emulation) | | Manual setup | Add your own API keys to .env | Yes |

Option 1: Use netlify dev (Recommended)
The simplest approach is to use the Netlify CLI for local development:

netlify dev
This starts a local server that emulates Netlify's environment, including AI Gateway access.

Option 2: Install @netlify/vite-plugin
For Vite-based projects, you can install the Netlify Vite plugin for local AI Gateway functionality:

npm install @netlify/vite-plugin
Then configure it in your vite.config.ts.

Option 3: Use Your Own API Keys
If you prefer not to use Netlify's tooling locally, add your own provider API keys to a .env file:

OPENAI_API_KEY=your-key-here
ANTHROPIC_API_KEY=your-key-here
GEMINI_API_KEY=your-key-here
Important Prerequisites
Production deployment required: The AI Gateway only activates after your first production deployment to Netlify
Netlify compute context required: AI features only work within Netlify Functions or Edge Functions—not in client-side code
Current Project Status
The project currently:

Does not have @netlify/vite-plugin installed
Uses standard npm run dev (not netlify dev)
Has environment variable placeholders ready in .env.example
To start using the AI Gateway locally, either switch to using netlify dev or install the Vite plugin.