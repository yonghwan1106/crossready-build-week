# CrossReady - Deep Audit Implementation Record

## Goal

Complete the shortest path from a promising prototype to a trustworthy demo:

1. real cross-artifact findings;
2. clickable evidence;
3. paid-call protection; and
4. errors that explain what happened without exposing secrets.

## Real cross-artifact findings

A live run now uses GPT-5.6 twice:

1. extract atomic requirements from the uploaded rules document; and
2. compare those requirements with bounded ZIP text previews and optional
   submission copy.

Both calls use the Responses API, Structured Outputs, `store: false`, low
reasoning effort and output verbosity, a 60-second per-call timeout inside one
115-second audit deadline, and a hashed `safety_identifier`. Browser
cancellation reaches the active call and prevents the second call from
starting. The extraction and cross-audit output ceilings are 5,000 and 7,000
tokens. OpenAI SDK retries are disabled so each stage makes at most one
generation attempt.

CrossReady does not trust the second model response directly. The server:

- allows only known requirement and artifact IDs;
- requires every model evidence excerpt to occur exactly in the cited preview;
- requires two distinct verified artifacts for a contradiction;
- fixes the finding claim to the extracted requirement rather than model prose;
- overrides manifest/hash findings with computed bytes; and
- downgrades missing, truncated, binary, PDF, visual, runtime, or external
  evidence to `NEEDS_HUMAN` when it cannot be fully verified.

The canonical broken sample remains free: exact file fingerprints unlock its
saved 12-finding answer key with summary counts `1 / 1 / 8 / 2` for Proven,
Missing, Contradicted, and Needs Human.

## Clickable evidence

The result screen puts the four status counts first. Every finding is a keyboard
button that opens a modal containing:

- linked requirement IDs;
- claim and explanation;
- artifact ID and exact locator;
- quoted evidence and provenance type; and
- the recommended next action.

Escape, background click, focus trapping, and focus restoration are supported.
The static preview is hidden after a real result so it cannot be mistaken for
the user's audit.

## Cost and upload protection

- Three paid live audits per client per ten minutes by default
- Ten paid live audits per server process per UTC day by default
- IP/session identities HMAC-hashed before storage or API use
- Sample and no-key scanner modes consume no paid-run allowance
- A 20 MiB multipart ceiling enforced while reading the stream
- A 256 KiB text-rules ceiling
- A 4 MiB / 40-page rules-PDF ceiling using conservative visible page markers
- Two active upload/scan requests per server instance by default
- Existing ZIP entry, file count, expanded-byte, encrypted-entry, duplicate
  path, and traversal protections remain active

The in-memory daily and active-request counters are suitable for the
single-process hackathon demo, not a distributed production deployment.
Production should use a durable shared limiter or firewall and retain an OpenAI
project spending cap.

## Error contract

Model failures are classified as authentication, quota, rate limit, timeout,
server, refusal, invalid output, bad request, or unknown. The server logs only
the safe category, retryability, operation, and request ID. The browser shows a
plain-language Korean explanation, an action, retry availability, and the
request ID when available.

If requirement extraction succeeds but semantic comparison fails, the response
is `partial`: extracted requirements and deterministic findings remain visible,
and no missing model result is claimed.

## Live GPT-5.6 verification

The full non-sample path was exercised against the bundled rules and broken ZIP
on 2026-07-18 after the hardening work:

- API-returned model: `gpt-5.6-sol` for the requested `gpt-5.6` model
- 14 extracted atomic requirements and exactly 14 final findings
- status total: 1 Proven, 4 Contradicted, 0 Missing, 9 Needs Human
- 21 evidence excerpts with server-computed line locators
- 2,938 extraction tokens in 36.65 seconds
- 5,540 cross-audit tokens in 48.08 seconds
- no model failure and no partial-result fallback

An initial 45-second extraction timeout correctly returned the scanner-only
fallback but proved too short for this real workload. The final 60 / 115 / 125
second model, server, and browser limits are based on the successful measured
run rather than a guessed value.

## Verification commands

```bash
cd project
npm test
npm run lint
npx tsc --noEmit
npm run build
```
