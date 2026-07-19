# CrossReady - Product Brief

> Decision status: LOCKED for the 2026-07-18 build milestone
> Track: Work & Productivity
> Tagline: Every artifact agrees before you submit.

## One-sentence problem

People submitting high-stakes work lose trust, time, and eligibility when their
rules, final files, repository, live product, video, and submission copy contain
claims that are individually plausible but mutually inconsistent.

## Primary users

- solo builders and freelancers preparing contest or grant submissions;
- small teams preparing proposals, certifications, and review packages; and
- reviewers who need traceable proof instead of a generic AI confidence score.

## Core solution

CrossReady ingests a requirements document and a submission bundle, inventories
the real artifacts, extracts atomic requirements and claims, and returns an
evidence-linked consistency report with four explicit states:

- `PROVEN`
- `MISSING`
- `CONTRADICTED`
- `NEEDS_HUMAN`

The product does not auto-submit, silently rewrite, or claim certainty without
evidence.

## Why this is different

CrossReady is not a form completion assistant, generic submission checklist, RFP
writer, or document summarizer. It verifies the actual bytes, rendered pages,
repository configuration, live-product evidence, video metadata, and final copy
against each other.

## OpenAI technology

- API: OpenAI Responses API
- Required model family: GPT-5.6
- Baseline extraction model: `gpt-5.6`
- Optional quality-first final audit: `gpt-5.6-sol`
- Inputs: rules text/PDF, PDF page images at high detail, artifact text, and
  deterministic scan results
- Output: Structured Outputs constrained by the repository JSON Schemas

GPT-5.6 is essential because the core task requires semantic comparison across
heterogeneous, long, multimodal artifacts. Deterministic code remains
authoritative for hashes, inventory, file sizes, page counts, and link status.

## Codex collaboration evidence

Codex is used for product framing, repository scaffolding, schema design, sample
fixture generation, implementation, testing, debugging, and final QA. Evidence
will include:

- the primary Codex `/feedback` session ID:
  `019f722a-e88a-7d60-9bd5-fd267a70556c`;
- dated Git commits beginning on 2026-07-18;
- README documentation of human decisions and Codex contributions; and
- test output covering the sample bundle and key user flow.

## MVP user flow

1. User selects a rules file and a submission ZIP.
2. CrossReady inventories the archive and previews accepted artifacts.
3. Deterministic checks run first.
4. GPT-5.6 extracts requirements and artifact claims into strict schemas.
5. The report groups evidence-linked findings by status and severity.
6. User opens the exact evidence and decides what to fix.
7. User reruns the audit and sees resolved findings turn green.

## MVP acceptance criteria

- The supplied broken sample bundle can be loaded without an account.
- At least five seeded cross-artifact defects are detected.
- Every reported contradiction contains two or more evidence locators.
- Hash and file-inventory checks do not depend on model judgment.
- The same sample produces a stable finding structure.
- Missing API configuration produces a designed error state and sample mode
  remains usable.
- No file is automatically changed or externally submitted.

## Deliberate non-goals

- authentication, organizations, billing, or persistent user storage;
- automatic form submission or automatic artifact rewriting;
- general web crawling;
- every archive and office-document format;
- medical, legal, or eligibility decisions;
- production dependence on a beta multi-agent API.

## Demo story

The demo bundle looks polished but contains mismatched model names, metrics,
internal document versions, video metadata, manifest hashes, and live-product
claims. CrossReady exposes these contradictions, opens the evidence, and turns
one finding from red to green after the artifact is corrected.

## Human decisions

- Work & Productivity was chosen for the workflow and organizational value,
  rather than positioning the product as a developer-only tool.
- Evidence quality is prioritized over automated fixing.
- The first version supports PDF, Markdown/text, JSON, source code, HTML
  snapshots, URLs, and ZIP archives only.
- Multi-agent execution is optional; a sequential fallback is required.
- The demo must run from a bundled fictional sample without requiring private
  user data.

## Submission preparation

- [x] Project concept
- [x] Problem, user, and value proposition
- [x] OpenAI technology role
- [x] MVP boundary
- [x] Demo scenario
- [x] Working end-to-end audit
- [x] Error and empty states
- [x] Public deployment
- [x] English Devpost description
- [x] Devpost hero/thumbnail image
- [x] Three submission screenshots
- [x] Upload-ready narrated MP4 under three minutes
- [x] Public YouTube video URL
- [x] Final `/feedback` session ID
- [x] Final Devpost submission confirmation evidence

Submitted project: <https://devpost.com/software/crossready>
