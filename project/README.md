# CrossReady

**Every artifact agrees before you submit.**

CrossReady is a cross-artifact evidence auditor for high-stakes submissions. It
compares requirements, deliverables, source code, live URLs, and submission copy
to show where a claim is proven, missing, contradicted, or still needs human
review.

This repository contains the working Day 2 prototype for OpenAI Build Week
2026.

## Current scope

- Real requirements-file and submission-ZIP upload
- Safe ZIP inventory, SHA-256, text preview, and manifest checks
- GPT-5.6 requirement extraction through the Responses API
- Structured Outputs constrained by the canonical requirement schema
- Honest bundled-sample and file-scan-only modes when no API key is present
- Four-state audit summary: Proven, Contradicted, Missing, Needs Review
- Exact source-to-source evidence presentation
- Responsive dark dashboard UI

The lower audit findings remain clearly labeled example data. The upload panel
and its result card are live: they read the selected ZIP, and they call GPT-5.6
only when a server-side API key is configured. Sample mode never calls the API
and says so in the result.

## Local development

Requirements:

- Node.js 20.9 or newer
- npm

Install dependencies and start the development server:

```bash
npm install
copy .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Available commands

```bash
npm run dev
npm run lint
npm test
npm run build
npm run start
```

## Architecture

- Next.js App Router and TypeScript
- Tailwind CSS
- OpenAI Responses API with GPT-5.6
- Structured Outputs for atomic requirement and evidence records
- Deterministic file checks alongside model-based cross-artifact review

The OpenAI client is initialized lazily inside the server-only extraction path,
so builds and bundled-sample audits do not require secrets. Model responses use
`store: false`.

## Environment

Copy `.env.example` to `.env.local` only for a live model test. Never commit real
API keys or prefix the key with `NEXT_PUBLIC_`.
