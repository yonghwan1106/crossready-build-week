# CrossReady

**Every artifact agrees before you submit.**

CrossReady is a cross-artifact evidence auditor for high-stakes submissions. It
compares requirements with submission copy and bounded text previews, then
combines model findings with ZIP inventory, SHA-256, and manifest facts to show
where a claim is proven, missing, contradicted, or still needs human review.

This repository contains the working CrossReady prototype for OpenAI Build Week
2026.

## Public reviewer demo

The production reviewer build is available at
**[crossready-build-week.vercel.app](https://crossready-build-week.vercel.app/)**.
Select **Try the broken sample**, leave the optional submission-copy field
blank, choose **Run sample audit**, and open any finding to inspect its source
locations and excerpts. No account is required.

The public deployment intentionally has no `OPENAI_API_KEY`. The 12-finding
saved-answer demo is used only when both bundled fingerprints match and optional
submission copy is blank. Entering copy exits saved-answer mode; a keyless
server returns scanner-only facts, while a configured server follows the live
path. The real GPT-5.6 path and its measured results are documented below.

## Current scope

- Real requirements-file and submission-ZIP upload
- Safe ZIP inventory, SHA-256, bounded text previews, listed manifest-hash
  verification, and unlisted-file coverage reporting
- GPT-5.6 requirement extraction through the Responses API
- GPT-5.6 cross-artifact findings constrained by Structured Outputs
- Server-verified evidence excerpts with deterministic manifest-integrity and
  completeness overrides
- Submission-copy comparison and clickable finding details
- Honest bundled-sample and file-scan-only modes when no API key is present
- Four-state audit summary: Proven, Contradicted, Missing, Needs Review
- Typed partial-result errors, model timeouts, and safe request IDs
- Per-client and daily live-audit cost limits
- Bounded multipart, archive, expanded-size, path, and file-count checks
- Responsive dark dashboard UI

The bundled broken sample returns 12 complete answer-key findings without an API
call. A normal upload performs a real requirements extraction and semantic
cross-audit when a server-side API key is configured. Model evidence is accepted
only when its artifact ID is allowlisted and its excerpt occurs in the supplied
artifact text. Semantic contradictions require two distinct artifacts.
Deterministic manifest findings use direct claim-to-byte and coverage facts;
uncertain model results are downgraded to Needs Review.

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

The current local verification baseline is 91 passing automated tests plus
clean lint, TypeScript, and production-build checks. Public-browser and Vercel
runtime checks are recorded for the submitted deployment; the new local
hardening changes require redeployment before those live checks can be renewed.

## Architecture

- Next.js App Router and TypeScript
- Tailwind CSS
- OpenAI Responses API with GPT-5.6
- Structured Outputs for atomic requirement and evidence records
- Deterministic file checks alongside model-based cross-artifact review

The OpenAI client is initialized lazily inside server-only paths, so builds and
bundled-sample audits do not require secrets. Model responses use `store: false`,
low output verbosity, a 60-second per-call timeout inside a 115-second
whole-audit deadline, and a hashed `safety_identifier`. The browser waits 125
seconds, so the server can stop both paid steps cleanly before the client gives
up. SDK retries are disabled, so one protected model stage cannot silently
expand into several generation attempts.

## Environment

Copy `.env.example` to `.env.local` only for a live model test. Never commit real
API keys or prefix the key with `NEXT_PUBLIC_`.

The default live-audit guard allows three paid audits per client per ten minutes
and ten per server process per UTC day. Override those limits deliberately with
the two `CROSSREADY_LIVE_AUDIT_*` variables in `.env.example`. At most two
requests parse uploads or scan ZIPs concurrently per instance by default; the
`CROSSREADY_ACTIVE_AUDIT_LIMIT` setting is clamped between one and ten.

## Data boundary and known limits

- The rules document, submission copy, and bounded text previews are sent to
  OpenAI during a live audit with `store: false`. CrossReady does not separately
  persist them, and ZIP binaries are not sent to the model.
- Text rules are capped at 256 KiB so one live audit cannot silently turn into
  an unusually large model input.
- Rules PDFs are limited to 4 MiB and 40 pages. The page ceiling uses visible
  PDF page-tree markers without a full PDF parser, so unusual compressed PDFs
  still require operator review.
- PDF excerpts and page locators are model-extracted and explicitly require
  human page confirmation; CrossReady does not claim independent PDF quote
  verification.
- When ZIP evidence is truncated or unavailable to the model, model-produced
  `PROVEN` and `MISSING` results are not treated as fully verified and are
  downgraded to Needs Review. PDFs, images, live URLs, and runtime behavior are
  not independently verified.
- The built-in daily counter is process-local. A public multi-instance
  deployment should add a durable shared rate-limit store or platform firewall,
  while retaining an OpenAI project spending limit as the hard budget.
- The active-request guard is also per-instance and is a CPU/memory pressure
  brake, not a durable public concurrency limit.

## Verified live runs

On 2026-07-18, an initial measured run through the live model path finished
successfully with the requested `gpt-5.6` model (API response model
`gpt-5.6-sol`). It produced 14 atomic requirements and exactly 14 final
findings, verified 21 exact line evidence references, and used 8,478 total
tokens. The two model stages took 36.65 and 48.08 seconds.

A later, separate reviewer-capture run used the same fictional challenge rules
file and intentionally broken ZIP. It read 11 files, displayed 16 final
findings, used 9,038 tokens, and took 71.9 seconds. These totals are kept
separate because they came from a different live-model execution. The later
result is preserved in the [reviewer evidence screenshot][reviewer-capture].

[reviewer-capture]: ../assets/screenshots/03-crossready-gpt56-live-result.png
