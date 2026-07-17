# CrossReady

**Every artifact agrees before you submit.**

CrossReady is a cross-artifact evidence auditor for high-stakes submissions. It
compares requirements, deliverables, source code, live URLs, and submission copy
to show where a claim is proven, missing, contradicted, or still needs human
review.

This repository currently contains the first static product prototype for
OpenAI Build Week 2026.

## Prototype scope

- Evidence-audit workspace and upload guidance
- Four-state audit summary: Proven, Contradicted, Missing, Needs Review
- Exact source-to-source evidence presentation
- Responsive dark dashboard UI
- OpenAI SDK installed for the next implementation phase

The OpenAI API is **not called yet**. All audit findings on the first screen are
clearly labeled example data.

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
npm run build
npm run start
```

## Planned architecture

- Next.js App Router and TypeScript
- Tailwind CSS
- OpenAI Responses API with GPT-5.6
- Structured Outputs for atomic requirement and evidence records
- Deterministic file checks alongside model-based cross-artifact review

API clients will be initialized lazily when the analysis route is implemented so
builds do not require secrets.

## Environment

Copy `.env.example` to `.env.local`. Never commit real API keys.
