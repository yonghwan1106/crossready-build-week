# CrossReady - Day 2 Implementation Record

## Working milestone

Connect two real parts of the product:

1. a deterministic scanner that reads the submitted ZIP as bytes; and
2. GPT-5.6 requirement extraction that returns the canonical requirement shape.

## Deterministic scanner boundary

The scanner inventories files, reads allowlisted text previews, computes
SHA-256 values, and checks `manifest.json`. It never runs code from the archive
and never extracts submitted files onto the server filesystem.

Requests are rejected before entry decompression when they exceed the configured
archive, file-count, per-entry, or total expanded-size limits. Absolute paths,
Windows paths, traversal segments, control characters, duplicate paths, and
encrypted entries are rejected.

## GPT-5.6 boundary

Only the rules document is passed to the model during this milestone. Markdown
and text are delimited as untrusted source material. PDFs are sent as base64
Responses API file inputs with high visual detail.

The server uses:

- model `gpt-5.6`;
- `store: false`;
- an 8,000-token output ceiling and a maximum of 75 extracted requirements;
- Structured Outputs generated from the repository Zod schema; and
- a prompt boundary that says document content is data, not instructions.

After parsing, the server also requires unique, continuous `REQ-001` numbering.
For Markdown and text rules, every returned source excerpt must occur in the
uploaded document after Unicode and whitespace normalization.

The API key is read only inside the server path. It is never sent to the browser.

## Honest no-key behavior

- `sample`: returned only when both uploaded files match the bundled sample
  SHA-256 fingerprints. The saved sample requirements are used and GPT-5.6 is
  explicitly reported as not called.
- `scanner_only`: the ZIP scan completes, but no model requirements are
  returned or implied.
- `live`: returned only after a real GPT-5.6 Structured Outputs response is
  parsed successfully.

## Verification evidence

- The bundled ZIP contains 11 real files.
- Its two seeded manifest claims both contradict the computed file hashes.
- Unit tests cover sample inventory, exact hashes, matching manifests, archive
  limits, unsafe paths, untrusted text framing, PDF high-detail input,
  Structured Outputs request options, and refusal handling.
- A live API smoke test remains pending until a server-side API key is available.

## Before public deployment

- Add platform-level rate limiting or authentication to the live GPT route.
- Keep the current 20 MiB request limit; use direct object-storage uploads if
  larger production packages become necessary.
- Run the pending live GPT-5.6 smoke test and record cost, latency, and token use.
