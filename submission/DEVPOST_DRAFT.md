# CrossReady — Devpost submission copy

## Project name

CrossReady

## One-line tagline

Every artifact agrees before you submit—an evidence-backed auditor that finds
contradictions across rules, files, code, and submission claims.

## Track

Work & Productivity

## Links

- Live demo: <https://crossready-build-week.vercel.app/>
- Source repository: <https://github.com/yonghwan1106/crossready-build-week>
- Demo video: <https://youtu.be/IAyBWqYpfhw>
- Devpost project: <https://devpost.com/software/crossready>
- Codex `/feedback` Session ID: `019f722a-e88a-7d60-9bd5-fd267a70556c`

## Inspiration

A high-stakes submission can pass every individual checklist and still fail as
a package.

The project description may claim one model while the code configures another.
A file named `FINAL_v3` may contain a report labeled version 2.1. The README may
say every test passes while the attached machine results show failures. These
inconsistencies are easy to miss because the evidence is scattered across
rules, documents, source files, manifests, and submission copy.

Many checklist-style submission workflows stop at whether a file exists. We
wanted to ask a more useful question:

**Do all of the submitted artifacts tell the same, provable story?**

That question became CrossReady.

## What it does

CrossReady audits a requirements document against a final submission package.

A user provides:

- a rules document in PDF, Markdown, or text format;
- a final ZIP submission bundle; and
- optionally, the description that reviewers will read.

CrossReady then:

1. safely inventories the ZIP without executing its contents;
2. computes SHA-256 hashes for the archive and individual files;
3. checks `manifest.json` claims against the submitted bytes;
4. extracts atomic, testable requirements with GPT-5.6;
5. compares those requirements with bounded textual evidence from the package;
6. classifies each requirement as `PROVEN`, `CONTRADICTED`, `MISSING`, or
   `NEEDS_HUMAN`; and
7. lets the user open every finding to inspect its file, locator, exact excerpt,
   provenance, and recommended next action.

The server does not accept a model-produced citation simply because it looks
plausible. The artifact ID must be known, and the quoted excerpt must exist in
the supplied text. A contradiction requires verified evidence from at least two
distinct artifacts. Deterministic manifest and hash results override model
output.

CrossReady never silently rewrites files and never submits anything on the
user's behalf.

## How we built it

We designed CrossReady as several trust layers instead of one large prompt.

### 1. Deterministic file layer

The ZIP scanner enforces archive, entry-count, expanded-size, duplicate-path,
encrypted-entry, and path-traversal limits. It creates a file inventory,
computes SHA-256 hashes, extracts bounded text previews, and compares manifest
claims with the actual bytes.

### 2. GPT-5.6 reasoning layer

The first model call converts the rules document into a structured set of
atomic requirements. The second call compares those requirements with the
available submission evidence and proposes one finding per requirement.

Both calls use the OpenAI Responses API and Structured Outputs.

### 3. Server verification layer

Before a model finding reaches the interface, CrossReady:

- rejects unknown requirement and artifact IDs;
- verifies that cited text occurs in the referenced artifact preview;
- computes line locators on the server;
- requires evidence from two artifacts before accepting a contradiction;
- replaces manifest conclusions with deterministic byte-level results; and
- downgrades unverifiable evidence to `NEEDS_HUMAN`.

### 4. Review interface

We built a responsive Next.js interface that puts the four status totals first.
Each finding opens an accessible evidence dialog with keyboard focus trapping,
Escape-to-close behavior, source restoration, exact excerpts, and a recommended
next action.

### 5. Cost and failure protection

Live audits have bounded inputs, output-token ceilings, per-stage and
whole-audit timeouts, browser cancellation propagation, disabled SDK retries,
per-client rate limits, process-level daily limits, and per-instance
concurrency limits.

Authentication, quota, rate-limit, timeout, refusal, invalid-output, and server
failures are translated into plain-language messages. If only part of an audit
completes, CrossReady shows the verified partial result instead of pretending
the entire audit succeeded.

## How GPT-5.6 is used

CrossReady uses GPT-5.6 for two distinct jobs:

1. **Requirement extraction:** turn a long rules document into atomic,
   traceable requirements with source excerpts and locators.
2. **Cross-artifact analysis:** compare each requirement with bounded evidence
   from submission copy and ZIP text previews.

The model output is constrained with Structured Outputs and Zod-compatible
schemas. Requests use `store: false`, low reasoning effort, low verbosity,
bounded output tokens, a hashed safety identifier, and no automatic SDK
retries.

GPT-5.6 proposes semantic findings, but deterministic code decides whether its
evidence is acceptable. This separation was essential: the model is useful for
finding relationships across differently worded documents, while the server
provides the evidence boundary.

We completed an initial measured local run through the live `gpt-5.6` path,
separate from the public saved-answer demo. The API returned model identifier
`gpt-5.6-sol`. That run produced:

- 14 extracted atomic requirements;
- exactly 14 final findings;
- 21 exact evidence excerpts with server-computed line references; and
- 8,478 total tokens across the two model stages.

For the final reviewer evidence, we made a later, distinct controlled live-model
run with the same fictional challenge rules file and intentionally broken ZIP.
It read 11 files and displayed 16 final findings, the `GPT-5.6-SOL` model badge,
9,038 tokens, and 71.9 seconds directly in the interface. Because these were two
different GPT-5.6 executions, their counts and token totals are reported
separately rather than treated as one benchmark. The later screen is preserved
as `assets/screenshots/03-crossready-gpt56-live-result.png`. It is a real paid
run, separate from the free 12-finding public sample.

## How Codex was used

Codex was our primary implementation and verification workspace. It helped us:

- turn the product concept into canonical requirement and audit-report schemas;
- generate and validate an intentionally inconsistent sample submission;
- implement the safe ZIP scanner and deterministic manifest checks;
- connect GPT-5.6 through the Responses API and Structured Outputs;
- build the server-side evidence-verification boundary;
- add timeouts, cancellation, cost guards, and typed partial failures;
- implement the accessible evidence-review interface;
- create and run automated tests;
- diagnose a hosting preset mismatch; and
- conduct adversarial code, API, security, and usability reviews.

We did not delegate product authority to the model. The human participant chose
the problem, track, four-state result model, evidence-first standard,
no-silent-rewrite rule, and public-demo cost boundary. Codex accelerated
implementation and verification within those decisions.

The current baseline is **67 passing automated tests**, together with clean
lint, TypeScript, production-build, browser-flow, and deployed-runtime checks.

## Challenges we ran into

### Trusting evidence without trusting every model statement

The hardest problem was not generating findings. It was deciding which findings
deserved to be shown as facts. We solved this by treating model output as a
proposal and requiring server-verifiable citations before accepting it.

### Distinguishing "missing" from "not inspectable"

A binary file, truncated preview, PDF page, external URL, or runtime claim may
contain the required evidence even when the current server cannot verify it.
Calling those cases "missing" would create false confidence. We introduced
`NEEDS_HUMAN` as a first-class result instead.

### Inspecting untrusted archives safely

A submission ZIP is user-controlled input. We had to bound compressed and
expanded sizes, reject unsafe paths and encrypted entries, prevent
duplicate-path ambiguity, and avoid executing or writing submitted content to
disk.

### Protecting a small hackathon API budget

A two-stage model workflow can quietly become expensive if retries, large
files, or parallel requests are left unbounded. We disabled hidden retries and
added explicit input, output, time, rate, concurrency, and daily limits.

### Demonstrating the product publicly without exposing paid credit

We intentionally deployed the reviewer build without an OpenAI API key. The
public sample demonstrates the complete interaction and evidence-review
experience through a fingerprint-locked bundled answer key, while the paid
GPT-5.6 path was measured separately in a controlled local run.

## Accomplishments that we are proud of

- Built a complete rules-to-evidence audit workflow rather than a static mockup.
- Verified a real two-stage GPT-5.6 run end to end.
- Made every finding inspectable through exact source evidence.
- Added deterministic byte-level manifest checks that can override model output.
- Prevented unverifiable claims from being presented as facts.
- Preserved useful partial results when a model stage fails.
- Created a no-login, no-cost reviewer path.
- Reached 67 passing automated tests plus clean build and browser verification.
- Kept the user in control: CrossReady reports discrepancies but does not
  rewrite or submit their work.

## What we learned

The most important lesson was that an AI audit product should not merely sound
confident. It should make confidence reviewable.

We learned that:

- structured output is only the beginning of reliability;
- model citations still need application-level verification;
- deterministic checks and semantic reasoning work better together than either
  does alone;
- `NEEDS_HUMAN` is not a failure—it is an honest product capability;
- cancellation and retry behavior are part of cost design;
- a narrow, deep workflow creates more trust than a broad list of loosely
  verified features; and
- an honest demo is stronger than implying that a saved sample used a paid
  model call.

## What's next

Our next priorities are:

1. replace process-local rate limits with a durable shared limiter for
   multi-instance deployment;
2. add richer independent PDF text and page verification;
3. inspect live URLs and runtime evidence through a controlled browser or
   sandbox;
4. connect repositories and CI results as explicit evidence sources;
5. export a reviewer-ready evidence report;
6. add audit history, collaboration, and finding resolution;
7. measure precision and false-positive rates on a larger benchmark set; and
8. add authenticated live GPT-5.6 audits with an explicit user-visible cost
   budget.

## Reviewer test steps

No account or API key is required.

1. Open <https://crossready-build-week.vercel.app/>.
2. Select **Try the broken sample**.
3. Confirm that both required files are selected and the interface shows
   `2 / 2 added`.
4. Select **Run sample audit**.
5. Review the 12 findings: 1 Proven, 8 Contradicted, 1 Missing, and 2 Needs
   review.
6. Open **Configured model contradicts submitted model**.
7. Inspect its four evidence records:
   - `submission/description.md`
   - `README.md`
   - `repository/src/config.ts`
   - `docs/technical-overview_FINAL_v3.pdf`
8. Notice that the submission-facing files claim GPT-5.6 while the sample
   configuration and PDF identify `gpt-4.1-mini`.
9. Close the dialog with the x button, by selecting the background, or by
   pressing Escape.
10. Scroll through the ZIP inventory, manifest results, and bundled
    requirements.

The reviewer flow is intentionally deterministic and free. It does not consume
OpenAI credit.

## Technology list

- OpenAI Responses API
- GPT-5.6
- Structured Outputs
- OpenAI JavaScript SDK 6.48
- Next.js 16.2.10 App Router
- React 19.2.4
- TypeScript 5
- Tailwind CSS 4
- Zod 4.4
- zip.js 2.8
- Vitest 4.1
- ESLint 9
- SHA-256 and HMAC-based identifiers
- Vercel

## Honesty and current limitations

The public deployment intentionally does **not** contain an OpenAI API key. Its
bundled broken-sample path uses a curated, fingerprint-locked 12-finding answer
key and does not call GPT-5.6. It demonstrates the actual file-loading,
ZIP-scanning, result, and evidence-review interface without consuming paid
credit.

The live GPT-5.6 path was tested separately in a controlled local environment.
An initial measured run produced 14 requirements, 14 findings, 21
server-computed line references, and 8,478 total tokens. A later, distinct
reviewer-capture run read 11 files and displayed 16 findings with 9,038 tokens
in 71.9 seconds. The totals differ because they came from separate executions.
We do not present either paid result as the free public sample.

Additional current limitations:

- The built-in daily and concurrency counters are process-local, not
  distributed.
- PDF excerpts and page locators are model-extracted and require human page
  confirmation.
- Images, binaries, live URLs, runtime behavior, and truncated previews are not
  treated as independently verified.
- Those uncertain cases are marked `NEEDS_HUMAN`.
- CrossReady reads bounded text previews and never executes submitted code.
- During a live audit, the rules document, optional submission copy, and bounded
  text previews are sent to OpenAI with `store: false`; ZIP binary files are not
  sent to the model.
- CrossReady does not separately persist uploaded audit content.
- The prototype is an evidence-review tool, not a complete production
  compliance or security system.
- A durable shared limiter and retained OpenAI project spending cap are required
  before enabling paid audits on a multi-instance public deployment.
