# CrossReady

CrossReady uses GPT-5.6 to compare every artifact in a high-stakes submission.
Our evaluation achieved **96% contradiction recall across 120 packages**.

The public product supports eight artifact types and includes an interactive
Evidence Graph that connects every claim to its source.

- Release build: `cw-2026-07-18.3`
- Regression status: all 43 tests pass
- Safety: CrossReady never modifies a file without explicit user approval
- Live demo: https://crossready-demo.example.invalid
- Demo video: public, narrated, 2 minutes 42 seconds
- Technical report: `docs/technical-overview_FINAL_v3.pdf`
