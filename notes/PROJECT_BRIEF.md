# CrossReady - Product Brief

> Decision status: final prototype boundary, updated 2026-07-19
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
writer, or document summarizer. It verifies the supplied package: ZIP inventory
and exact bytes, allowlisted text and JSON previews, manifest hash claims and
coverage, and optional submission copy. It does not independently render ZIP
PDFs, play videos, visit URLs, or execute code; those cases remain
`NEEDS_HUMAN`.

## OpenAI technology

- API: OpenAI Responses API
- Required model family: GPT-5.6
- Requested model for both live stages: `gpt-5.6`
- Rules PDFs: high-detail Responses API file inputs
- ZIP evidence: bounded previews from allowlisted text, JSON, code, and HTML
  files
- Output: Structured Outputs constrained by the repository Zod schemas

`gpt-5.6-sol` is retained only where it records the API-returned model
identifier from a verified historical run. GPT-5.6 extracts requirements from
rules text or PDF and compares them with supplied text evidence. Deterministic
code remains authoritative for ZIP inventory, file sizes, SHA-256 values,
manifest integrity, and manifest coverage. CrossReady does not independently
verify rendered pages or link status.

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
4. GPT-5.6 first extracts requirements into a strict schema, then a second
   structured call compares them with bounded textual evidence.
5. The report groups evidence-linked findings by status and severity.
6. User opens the exact evidence and decides what to fix.
7. User reruns the audit with corrected inputs and reviews the newly generated
   report.

## MVP acceptance criteria

- The supplied broken sample bundle can be loaded without an account.
- At least five seeded cross-artifact defects are detected.
- Every model-produced semantic contradiction contains verified excerpts from
  two distinct artifacts; deterministic manifest findings use direct
  manifest-to-byte facts.
- Hash and file-inventory checks do not depend on model judgment.
- The same sample produces a stable finding structure.
- Missing API configuration returns an explicit `scanner_only` state. The
  saved-answer sample remains available only for the exact bundled files with
  the optional submission-copy field left blank.
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
internal document versions, packaged video metadata, manifest hashes, and a
packaged live-product snapshot. CrossReady exposes the seeded contradictions
and opens their evidence; the demo does not claim to fetch the live site or play
the video.

## Human decisions

- Work & Productivity was chosen for the workflow and organizational value,
  rather than positioning the product as a developer-only tool.
- Evidence quality is prioritized over automated fixing.
- The first version accepts a PDF, Markdown, or TXT rules file plus one ZIP. It
  reads bounded previews from allowlisted text, JSON, source-code, and HTML
  files inside the ZIP. PDFs, images, URLs, runtime behavior, and other binaries
  remain inventory-only or human-review evidence.
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
