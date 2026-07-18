# CrossReady

**Every artifact agrees before you submit.**

CrossReady is an evidence-backed audit workspace for high-stakes submission
packages. It checks whether the rules, final PDF, README, repository, live
product, video metadata, and submission copy all describe the same product.

This repository is being built for OpenAI Build Week 2026 in the
**Work & Productivity** track.

## The problem

A submission can pass every individual checklist and still fail as a package:

- the description claims a feature the live product does not expose;
- the README names GPT-5.6 while the repository calls another model;
- a file named `FINAL` contains an older internal version;
- metrics differ between the technical report and submission copy; or
- a manifest points to bytes that are no longer in the ZIP.

Existing form checkers mostly verify that fields and attachments exist.
CrossReady verifies that claims and evidence agree across artifacts.

## MVP workflow

1. Add a requirements document and a submission ZIP.
2. Run deterministic checks on file inventory, hashes, links, and PDF metadata.
3. Use GPT-5.6 to extract atomic requirements and cross-artifact claims.
4. Review findings as `PROVEN`, `MISSING`, `CONTRADICTED`, or `NEEDS_HUMAN`.
5. Open the exact page, file, line, or URL that supports each finding.

CrossReady never silently edits artifacts and never submits on a user's behalf.

## OpenAI integration

- **Responses API**
- **GPT-5.6** for multimodal requirement and claim extraction
- **PDF file inputs with high visual detail**
- **Structured Outputs** for schema-constrained requirements and findings
- An optional final adversarial review pass after deterministic checks

The OpenAI client will be initialized only inside server-side request handlers.
The API key must never be exposed to the browser.

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
- [ ] End-to-end audit implementation
- [ ] Public deployment
- [ ] Demo video and Devpost submission

Validate the Day 1 schemas and intentionally broken fixture:

```bash
node scripts/validate_day1.mjs
```

## Day 2 status - file scanner and GPT-5.6 wiring

- [x] Read real ZIP entries without executing or writing submitted files
- [x] Enforce archive, file-count, expanded-size, and path-safety limits
- [x] Compute SHA-256 for the archive and every submitted file
- [x] Compare `manifest.json` claims with the exact submitted bytes
- [x] Connect GPT-5.6 requirement extraction through the Responses API
- [x] Constrain model output with the canonical Zod requirement schema
- [x] Add honest `sample` and `scanner_only` modes when no API key is present
- [x] Connect the upload form and bundled broken-sample flow
- [ ] Run a live GPT-5.6 smoke test with a server-side API key

Run the automated scanner and extraction-contract tests:

```bash
cd project
npm test
```

Run the app without an API key and choose **Load broken sample** to test the
complete local sample flow. To test live extraction, copy `project/.env.example`
to `project/.env.local`, add `OPENAI_API_KEY` locally, and restart the app. Never
put the key in a browser variable or commit it.

## Deadline

The submission deadline is **2026-07-22 09:00 KST**. The internal deadline is
08:00 KST.
