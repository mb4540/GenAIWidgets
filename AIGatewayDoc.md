Use popular AI models in your code, without needing to manage API keys or external accounts.

This feature is available on Credit-based plans only, including the Free, Personal, and Pro plans. If you are on an Enterprise plan and you’re interested, reach out to your Account Manager.

Overview
The AI Gateway service simplifies technical and operational concerns when using AI inference in your code, by removing the need to:

Open an account with each provider you want to use.
Maintain a separate credit balance with each provider.
Copy the API key from each provider to your projects on Netlify.
Explore an AI Gateway example

Learn how AI Gateway works in this TanStack Start chat app example, which automatically proxies your requests to a supported AI provider with built-in security, usage analytics, and rate limiting.

Demo repo
Demo site
How AI Gateway works in this example
AI Gateway examples
For a video overview of how the AI Gateway works with a fun demo project, check out our AI Gateway gameshow demo.


Check out more examples of working projects that are powered with AI models in our AI Gateway examples docs.

How it works
By default, Netlify automatically sets the appropriate environment variables that AI client libraries typically use for configuration, in all Netlify compute contexts (e.g., Netlify Functions, Edge Functions, Preview Server, etc.).

These variables include:

API keys for OpenAI, Anthropic, and Google Gemini.
A custom base URL for each provider, to route requests via the AI Gateway service.
These variables are picked up by the official client libraries of these providers, so no extra configuration is necessary. Alternatively, if you make AI calls via a provider’s REST API, these values are easy to incorporate in your code.

When receiving a request from a client, the AI Gateway makes the call to the AI provider on your behalf. Then, it bills your Netlify account by converting the actual token usage in the request into credits, using your existing credit quota.

Local development with the AI Gateway

The AI Gateway has full support with the Netlify CLI. For Vite-based projects, you can also use the Netlify Vite plugin to access AI Gateway locally without running netlify dev. Check our Quickstart for a hands-on guided example project using the AI Gateway.

Note: A project must have a production deploy for the AI Gateway to activate, so if you’re creating a new project locally, deploy to production at least once to enable it.

The AI Gateway does not store your prompts or model outputs. Learn more about Security and Privacy for AI features. To opt out, check your opt-out options.

Support in web frameworks
When you develop server-side code with any web framework supported by Netlify (e.g., Astro; Tanstack Start; Next.js, Gatsby, Nuxt, etc.), your code is packaged in Netlify Functions and Edge Functions under the hood, as part of the build process.

Therefore, the above environment variables are available as when explicitly using Netlify compute primitives, without any further settings required.

Using the AI Gateway
For a quickstart, check out our Quickstart for AI Gateway.

The AI Gateway is available by default in all credit-based plans, unless:

You have disabled Netlify AI Features for your team, or:
You have set your own API keys for AI providers via environment variables. Netlify does not override these keys. You can add or remove your own keys at any point.
For full information on which environment variables are automatically set, and how to control this behavior, see here.

Using official client libraries
If you’re using any of the following libraries, no configuration is required. The AI Gateway automatically provides the necessary environment variables that these libraries use:

Anthropic Claude
OpenAI
Google Gemini
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();
// No API key or base URL configuration needed - automatically uses:
// process.env.ANTHROPIC_API_KEY and process.env.ANTHROPIC_BASE_URL

async function callAnthropic() {
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 1024,
    messages: [{ role: 'user', content: 'Hello!' }]
  });
  return message;
}

Library: Anthropic TypeScript API Library

Using official REST APIs
Anthropic Claude
OpenAI
Google Gemini
async function callAnthropic() {
  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  const ANTHROPIC_BASE_URL = process.env.ANTHROPIC_BASE_URL;

  const response = await fetch(`${ANTHROPIC_BASE_URL}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 1024,
      messages: [{ role: 'user', content: 'Hello!' }]
    })
  });
  return await response.json();
}

Using third-party client libraries
If you are using a client library that does not work out-of-the-box with the environment variables set for the AI Gateway, you need to manually pass the API key and base URL as arguments to the library.

This is similar to manually reading & passing variable values when using a provider’s REST API. See Using official REST APIs above for the relevant variable names.

Managing environment variables
If you have already set an API key or base URL at the project or team level, Netlify will never override it.

When a Netlify Function or Edge Function is initialized, the following environment variables are set to the appropriate values for the AI Gateway:

OPENAI_API_KEY and OPENAI_BASE_URL - unless any of these is already set by you at the project or team level.
ANTHROPIC_API_KEY and ANTHROPIC_BASE_URL - unless any of these is already set by you.
GEMINI_API_KEY and GOOGLE_GEMINI_BASE_URL- unless any of these is already set by you, or if either GOOGLE_API_KEY or GOOGLE_VERTEX_BASE_URL are set.
For each provider, the above check is done separately. Meaning, if you have only set OPENAI_API_KEY to your own API key, it will not be overridden (and neither would OPENAI_BASE_URL be set) - but the values for Anthropic and Google will be set.

NETLIFY_AI_GATEWAY_KEY and NETLIFY_AI_GATEWAY_BASE_URL environment variables are always injected into the AI Gateway-supported runtimes. If you want to mix different setups with your own keys and Netlify’s or you want to be explicit about using AI Gateway keys in your calls, use these env variables as they will never collide with other environment variables values.

To prevent any variables from being automatically set, you can disable AI Features.

Model availability
The AI Gateway supports the following AI providers and models.

AI Provider	Model
Anthropic	claude-3-5-haiku-20241022
Anthropic	claude-3-7-sonnet-20250219
Anthropic	claude-3-haiku-20240307
Anthropic	claude-haiku-4-5
Anthropic	claude-haiku-4-5-20251001
Anthropic	claude-opus-4-1-20250805
Anthropic	claude-opus-4-20250514
Anthropic	claude-opus-4-5
Anthropic	claude-opus-4-5-20251101
Anthropic	claude-sonnet-4-0
Anthropic	claude-sonnet-4-20250514
Anthropic	claude-sonnet-4-5
Anthropic	claude-sonnet-4-5-20250929
Gemini	gemini-2.0-flash
Gemini	gemini-2.0-flash-lite
Gemini	gemini-2.5-flash
Gemini	gemini-2.5-flash-image
Gemini	gemini-2.5-flash-image-preview
Gemini	gemini-2.5-flash-lite
Gemini	gemini-2.5-flash-lite-preview-09-2025
Gemini	gemini-2.5-flash-preview-09-2025
Gemini	gemini-2.5-pro
Gemini	gemini-3-flash-preview
Gemini	gemini-3-pro-image-preview
Gemini	gemini-3-pro-preview
Gemini	gemini-flash-latest
Gemini	gemini-flash-lite-latest
Openai	codex-mini-latest
Openai	gpt-4.1
Openai	gpt-4.1-mini
Openai	gpt-4.1-nano
Openai	gpt-4o
Openai	gpt-4o-mini
Openai	gpt-5
Openai	gpt-5-2025-08-07
Openai	gpt-5-codex
Openai	gpt-5-mini
Openai	gpt-5-mini-2025-08-07
Openai	gpt-5-nano
Openai	gpt-5-pro
Openai	gpt-5.1
Openai	gpt-5.1-2025-11-13
Openai	gpt-5.1-codex
Openai	gpt-5.1-codex-max
Openai	gpt-5.1-codex-mini
Openai	gpt-5.2
Openai	gpt-5.2-2025-12-11
Openai	gpt-5.2-pro
Openai	gpt-5.2-pro-2025-12-11
Openai	o3
Openai	o3-mini
Openai	o4-mini
Pricing
To understand pricing for AI Gateway, check out our Pricing for AI features docs.

Rate limits
The AI Gateway has one type of limit: Tokens Per Minute (TPM). Limits are per model and differ by your account plan.

The rate limit is scoped to your account. Meaning, requests made and tokens used for any project in your account are counted together towards your limits.

Enterprise customers have extended limits - contact your Account Manager to learn more.

Configuring advanced rate limiting

We recommend that you set up rate limiting rules for Netlify functions or edge fuctions that use the AI gateway.

This lets you limit any given client from abusing calls to the AI Gateway, thus avoiding high costs over time or hitting your account-wide AI gateway limits.

Tokens per minute (TPM)
For TPM, both input and output tokens are counted towards the limit.

However, cached input tokens are excluded for Anthropic models, and included for other providers.

AI Provider	Model	Free plan	Personal plan	Pro plan
Anthropic	claude-3-5-haiku-20241022	1,200	6,000	9,600
Anthropic	claude-3-7-sonnet-20250219	18,000	90,000	180,000
Anthropic	claude-3-haiku-20240307	6,000	12,000	18,000
Anthropic	claude-haiku-4-5	12,000	60,000	96,000
Anthropic	claude-haiku-4-5-20251001	12,000	60,000	96,000
Anthropic	claude-opus-4-1-20250805	1,800	3,600	12,000
Anthropic	claude-opus-4-20250514	1,800	3,600	12,000
Anthropic	claude-opus-4-5	1,800	3,600	12,000
Anthropic	claude-opus-4-5-20251101	1,800	3,600	12,000
Anthropic	claude-sonnet-4-0	18,000	90,000	180,000
Anthropic	claude-sonnet-4-20250514	18,000	90,000	180,000
Anthropic	claude-sonnet-4-5	18,000	90,000	180,000
Anthropic	claude-sonnet-4-5-20250929	18,000	90,000	180,000
Gemini	gemini-2.0-flash	50,000	100,000	150,000
Gemini	gemini-2.0-flash-lite	50,000	100,000	150,000
Gemini	gemini-2.5-flash	8,000	40,000	64,000
Gemini	gemini-2.5-flash-image	3,000	6,000	20,000
Gemini	gemini-2.5-flash-image-preview	3,000	6,000	20,000
Gemini	gemini-2.5-flash-lite	50,000	100,000	150,000
Gemini	gemini-2.5-flash-lite-preview-09-2025	50,000	100,000	150,000
Gemini	gemini-2.5-flash-preview-09-2025	8,000	40,000	64,000
Gemini	gemini-2.5-pro	24,000	120,000	240,000
Gemini	gemini-3-flash-preview	24,000	120,000	240,000
Gemini	gemini-3-pro-image-preview	24,000	120,000	240,000
Gemini	gemini-3-pro-preview	24,000	120,000	240,000
Gemini	gemini-flash-latest	8,000	40,000	64,000
Gemini	gemini-flash-lite-latest	50,000	100,000	150,000
Openai	codex-mini-latest	30,000	150,000	300,000
Openai	gpt-4.1	18,000	90,000	180,000
Openai	gpt-4.1-mini	50,000	250,000	400,000
Openai	gpt-4.1-nano	250,000	500,000	750,000
Openai	gpt-4o	18,000	90,000	180,000
Openai	gpt-4o-mini	250,000	500,000	750,000
Openai	gpt-5	18,000	90,000	180,000
Openai	gpt-5-2025-08-07	18,000	90,000	180,000
Openai	gpt-5-codex	18,000	90,000	180,000
Openai	gpt-5-mini	60,000	300,000	480,000
Openai	gpt-5-mini-2025-08-07	60,000	300,000	480,000
Openai	gpt-5-nano	300,000	600,000	900,000
Openai	gpt-5-pro	18,000	90,000	180,000
Openai	gpt-5.1	18,000	90,000	180,000
Openai	gpt-5.1-2025-11-13	18,000	90,000	180,000
Openai	gpt-5.1-codex	18,000	90,000	180,000
Openai	gpt-5.1-codex-max	18,000	90,000	180,000
Openai	gpt-5.1-codex-mini	60,000	300,000	480,000
Openai	gpt-5.2	18,000	90,000	180,000
Openai	gpt-5.2-2025-12-11	18,000	90,000	180,000
Openai	gpt-5.2-pro	18,000	90,000	180,000
Openai	gpt-5.2-pro-2025-12-11	18,000	90,000	180,000
Openai	o3	90,000	180,000	600,000
Openai	o3-mini	30,000	150,000	300,000
Openai	o4-mini	30,000	150,000	300,000
Limitations
The AI Gateway has the following limitations at this time:

Using the AI Gateway requires that the site has had at least one production deployment in the past.
The context window (input prompt) is limited to 200k tokens.
Prompt caching:
Anthropic Claude: only the default 5-minute ephemeral cache duration is supported for Claude.
OpenAI: the AI Gateway sets a per-account prompt_cache_key.
Google Gemini: explicit context caching is not supported.
The AI Gateway does not pass through any request headers (and thus you cannot enable proprietary experimental features via headers).
Batch inference is not supported.
Priority processing (an OpenAI feature) is not supported.
Monitor AI Gateway usage
To help you monitor AI Gateway usage, check out our docs on monitoring AI feature usage.

Links:
Demo Repo: https://github.com/netlify-templates/tanstack-template

Quick Start Guide:
Quickstart for AI Gateway

Copy page
Here is an example of how to quickly set up a simple, modern web app with AI features. Unfortunately, the web app uses its powers to generate dad jokes.

This example uses the public Vite + React starter template, the OpenAI client library, and a Netlify Function.

Prerequisites
If you already have a credit-based plan on Netlify, you’re good to go. If you have a legacy plan, you’ll need to switch to one of our current plans (free or paid) to run this example.
To develop locally, you need the Netlify CLI installed and up-to-date.
Make sure you have an up-to-date version of the Netlify CLI:

Terminal window
npm install -g netlify-cli@latest

If you’re not already logged in to your Netlify account from the CLI (or not sure), run:

Terminal window
netlify login

1. Create and deploy a project
Create a new Vite and React project using this template:
Terminal window
npm create vite@latest dad-jokes -- --template react --no-interactive
cd dad-jokes
npm install

Next, create a new Netlify project. For simplicity’s sake, you don’t need to create a GitHub repository yet - just confirm all defaults.

Terminal window
netlify init

Deploy your site to production on Netlify using the Netlify CLI. Note that AI Gateway requires that your Netlify project have at least one production deploy.
Terminal window
netlify deploy --prod --open

Once the deploy is ready, the browser should automatically navigate to your new live site.

Now, let’s add some AI.

2. Add an AI-powered function
In the project root directory, install the OpenAI client library:

Terminal window
npm install openai

Create a directory for Netlify Functions:

Terminal window
mkdir -p netlify/functions

Create the netlify/functions/joke.js file for generating AI jokes, with this content:

import process from "process";
import OpenAI from "openai";

const dadJokeTopics = [
  "Coffee", "Elevators", "Fishing", "Math class", "Computers", "Socks",
];

const setupMessage =
  "For the AI Gateway to work, ensure you have a credit-based plan" +
  " and a linked project that you deployed live at least once";

export default async () => {
  if (!process.env.OPENAI_BASE_URL)
    return Response.json({ error: setupMessage });

  const randomTopic =
    dadJokeTopics[Math.floor(Math.random() * dadJokeTopics.length)];

  try {
    const client = new OpenAI();
    const res = await client.responses.create({
      model: "gpt-5-mini",
      input: [
        {
          role: "user",
          content: `Give me a random short dad joke about ${randomTopic}`,
        },
      ],
      reasoning: { effort: "minimal" },
    });
    const joke = res.output_text?.trim() || "Oops! I'm all out of jokes";

    return Response.json({
      topic: randomTopic,
      joke,
      model: res.model,
      tokens: {
        input: res.usage.input_tokens,
        output: res.usage.output_tokens,
      },
    });
  } catch (e) {
    return Response.json({ error: `${e}` }, { status: 500 });
  }
};

export const config = {
  path: "/api/joke",
};

When running locally with the Netlify CLI, or deploying live, your new function will be accessible via the route /api/joke.

3. Add a simple user interface
Replace the default contents of src/App.jsx with:

import { useState } from "react";
import "./App.css";

export default function App() {
  const [joke, setJoke] = useState();
  const [loading, setLoading] = useState(false);

  const getJoke = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/joke");
      setJoke(res.ok ? await res.json() : { error: res.status });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <h1>Tell me a dad joke</h1>
      <button onClick={getJoke} disabled={loading}>
        {loading ? "Dad is thinking..." : "Get joke"}
      </button>
      <pre style={{ border: "solid", textAlign: "left", padding: "1em" }}>
        {JSON.stringify(joke, null, 2)}
      </pre>
    </>
  );
}

4. Run locally
You can run your project locally using either the Netlify CLI or the Netlify Vite plugin:

Using Netlify CLI
Using Netlify Vite Plugin
Run:

Terminal window
netlify dev

The homepage of your new web app should open automatically, and you can start generating jokes.

Note that you did not need to create an OpenAI account or set any keys, because the AI Gateway is automatically used.

Finally, if you want, you can deploy to Netlify again to publish your site and make the AI-enabled changes go live. This allows you to share your AI-enabled site live on the internet.