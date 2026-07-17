# Demo fixtures

`challenge-rules.md` and `CrossReady_Broken_Submission.zip` form the no-login
demo input.

The archive is fictional and intentionally inconsistent. It must never be used
as a real submission. The unzipped source is kept in `broken-submission/` so
every seeded defect is inspectable in Git.

`expected-findings.json` is the acceptance-test answer key and is intentionally
kept outside the uploaded ZIP.

## Seeded defects

- model name mismatch;
- video visibility, duration, and narration mismatch;
- evaluation metric mismatch;
- stale internal PDF version;
- reserved invalid live-demo domain;
- manifest hash mismatch; and
- claimed feature absent from the live-product snapshot;
- build identifier mismatch;
- passing-test claim contradicted by machine results;
- an automatic-correction setting that requires human review; and
- one proven reviewer test path as a green control.

The PDF also contains one intentionally invisible text-layer claim on page 2.
It is extractable as text but absent from the rendered page, allowing the demo
to distinguish semantic extraction from visual evidence.
