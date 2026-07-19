# CrossReady

**Every artifact agrees before you submit.**

**CrossReady is a CI-style preflight check for supplied submission packages.**
It checks requirements, optional final copy, ZIP contents, text-readable source
configuration, manifest integrity and coverage, and exact file hashes before
submission. It does not yet integrate with a CI provider.

It is an evidence-backed audit workspace for high-stakes submission packages.
It compares requirements with submission copy and bounded text previews, then
combines those findings with ZIP inventory, manifest, and hash facts. PDF,
image, runtime, and external-page claims that it cannot independently verify
stay in human review.

This repository contains the submitted CrossReady entry for OpenAI Build Week
2026 in the **Work & Productivity** track.

## Live reviewer demo

Open **[crossready-build-week.vercel.app](https://crossready-build-week.vercel.app/)**
and follow this no-login, no-cost path:

1. Select **Try the broken sample**.
2. Leave the optional submission-copy field blank.
3. Select **Run sample audit**.
4. Open the first finding to inspect four exact evidence records.

The public reviewer build intentionally has no OpenAI API key, so visitors
cannot consume paid credit. The saved 12-finding answer set is used only for
the exact bundled files with blank optional copy. Adding copy exits saved-answer
mode; the keyless public build then returns scanner-only facts.
The separate GPT-5.6 live path was verified on 2026-07-18. An initial measured
run produced 14 extracted requirements, 14 findings, 21 server-computed line
references, and 8,478 total tokens. A later, distinct reviewer-capture run read
11 files, displayed 16 findings, used 9,038 tokens, and took 71.9 seconds. The
totals are reported separately because they came from two different live-model
executions.

The demo truthfully reports the 64 tests that existed at recording time. Final
consistency hardening increased the current repository baseline to 91 passing
automated tests.

## Quick start

```bash
cd project
npm install
npm test
npm run dev
```

Open <http://localhost:3000>, select **Try the broken sample**, and then select
**Run sample audit**.
The sample does not require an API key. Full environment and command details are
in [`project/README.md`](project/README.md).

## The problem

A submission can pass every individual checklist and still fail as a package:

- the description contradicts a packaged live-product snapshot;
- the README names GPT-5.6 while the repository calls another model;
- a file named `FINAL` contains an older internal version;
- metrics differ between the technical report and submission copy; or
- a manifest points to bytes that are no longer in the ZIP.

Existing form checkers mostly verify that fields and attachments exist.
CrossReady verifies that claims and evidence agree across artifacts.

The same final-gate workflow applies to RFP bids, grant applications,
certification and audit packages, client deliverables, and research or
competition submissions.

## MVP workflow

1. Add a requirements document and a submission ZIP.
2. Run deterministic checks on file inventory, exact hashes, each listed
   manifest claim, files omitted from the manifest, and package safety.
3. Use GPT-5.6 to extract atomic requirements and compare bounded text evidence.
4. Review findings as `PROVEN`, `MISSING`, `CONTRADICTED`, or `NEEDS_HUMAN`.
5. Inspect the artifact, locator type such as line, page, hash, or metadata, and
   the supporting excerpt.

A model-produced semantic contradiction requires verified excerpts from at
least two distinct artifacts. Manifest integrity and completeness findings are
computed separately from manifest claims and exact file bytes.

CrossReady never silently edits artifacts and never submits on a user's behalf.

## OpenAI integration

- **Responses API**
- **GPT-5.6** for multimodal requirement extraction and text-based claim
  comparison
- **PDF file inputs with high visual detail**
- **Structured Outputs** for schema-constrained requirements and findings
- A semantic cross-audit after deterministic package checks

The OpenAI client is initialized only inside server-side request handlers.
The API key must never be exposed to the browser.

## How Codex accelerated development

Codex was the primary implementation and verification workspace:

- converted the product decision into canonical requirement and audit schemas;
- generated and validated the intentionally inconsistent sample ZIP;
- implemented the safe ZIP scanner and GPT-5.6 Structured Outputs calls;
- built server-side evidence verification, deterministic manifest overrides,
  cost guards, cancellation, and typed error handling;
- implemented the accessible evidence dialog and reviewer flow;
- ran 91 automated tests plus clean lint, TypeScript, and production-build
  checks;
- completed browser/runtime verification for the submitted deployment and an
  independent adversarial code review; and
- diagnosed the first hosting preset mismatch and verified the corrected
  production deployment.

Primary Codex `/feedback` Session ID:
`019f722a-e88a-7d60-9bd5-fd267a70556c`.

Claude was used only for a separate adversarial final-review pass. Codex
remained the primary implementation and verification workspace.

## Human product decisions

The human participant retained authority over the product and submission:

- chose the **Work & Productivity** track and the narrow cross-artifact problem;
- required four honest states rather than a false pass/fail answer;
- prohibited silent rewriting and automatic submission;
- required exact evidence before accepting a model-produced finding;
- chose a free, no-key public reviewer build to protect paid API credit; and
- kept PDF, visual, runtime, and external checks in human-review status when the
  server could not verify them directly.

These decisions are recorded in `notes/DECISIONS_2026-07-18.md` and
`notes/PROJECT_BRIEF.md`.

## Repository map

- `project/` - Next.js application
- `schemas/` - canonical requirement and audit-report JSON Schemas
- `samples/` - fictional challenge rules, broken submission bundle, and answer key
- `scripts/` - reproducible sample artifact generators
- `notes/` - product brief and dated human decisions
- `submission/` - final Devpost materials
- `assets/` - logo, screenshots, and demo media
- `evidence/` - local registration/submission proof; intentionally not committed

## Day 1 status - 2026-07-18

- [x] Product concept and track locked
- [x] Scope and approval boundaries defined
- [x] Requirement and audit result schemas drafted
- [x] Intentionally inconsistent sample package designed
- [x] End-to-end audit implementation
- [x] Public deployment and reviewer flow verified
- [x] Upload-ready narrated demo MP4
- [x] Public YouTube upload
- [x] Devpost project creation and final submission

Final Devpost project: <https://devpost.com/software/crossready>

Validate the Day 1 schemas and intentionally broken fixture:

```bash
node scripts/validate_day1.mjs
```

## Day 2 status - file scanner and GPT-5.6 wiring

- [x] Read real ZIP entries without executing or writing submitted files
- [x] Enforce archive, file-count, expanded-size, and path-safety limits
- [x] Compute SHA-256 for the archive and every submitted file
- [x] Compare listed `manifest.json` claims with exact bytes and report
  submitted files omitted from the manifest separately
- [x] Connect GPT-5.6 requirement extraction through the Responses API
- [x] Constrain model output with the canonical Zod requirement schema
- [x] Add honest `sample` and `scanner_only` modes when no API key is present
- [x] Connect the upload form and bundled broken-sample flow
- [x] Run a live GPT-5.6 smoke test with a server-side API key

Run the automated scanner and extraction-contract tests:

```bash
cd project
npm test
```

Run the app without an API key and choose **Try the broken sample** to test the
complete local sample flow. To test live extraction, copy `project/.env.example`
to `project/.env.local`, add `OPENAI_API_KEY` locally, and restart the app. Never
put the key in a browser variable or commit it.

## Deep-audit milestone - cross-check, evidence, cost, and errors

- [x] Generate real GPT-5.6 findings from requirements, ZIP text previews, and
  optional submission copy
- [x] Complete a paid live end-to-end run: 14 requirements, 14 findings, and
  21 server-computed line references
- [x] Override model output with deterministic manifest-integrity and
  manifest-coverage facts
- [x] Accept model evidence only when the artifact ID and exact excerpt verify
- [x] Downgrade model-produced `PROVEN` and `MISSING` results when submitted
  evidence is incomplete
- [x] Return the canonical 12-finding sample report only for exact sample
  fingerprints with blank optional copy
- [x] Open every finding in a keyboard-accessible evidence detail dialog
- [x] Add 60-second per-call, 115-second whole-audit, and 125-second browser
  timeouts with cancel/retry propagation
- [x] Distinguish authentication, quota, rate-limit, timeout, server, refusal,
  request, and invalid-output failures
- [x] Limit paid runs per client and per server-process day
- [x] Limit one audit to 256 KiB text rules, 4 MiB detected 40-page PDFs, and
  5,000/7,000 model output tokens
- [x] Limit active upload/ZIP work to two requests per server instance
- [x] Reject multipart bodies that exceed 20 MiB even without `Content-Length`

The built-in daily counter is intentionally lightweight and process-local for
the hackathon demo. Before a multi-instance public launch, back it with durable
shared storage or a platform firewall and keep the OpenAI project spending cap
as the final cost boundary.

## Deadline

The submission deadline is **2026-07-22 09:00 KST**. The internal deadline is
08:00 KST.
