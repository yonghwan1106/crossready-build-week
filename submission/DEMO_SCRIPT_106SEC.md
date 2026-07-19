# CrossReady 106-second demo script

Final video: `submission/CrossReady_Demo_Final_106s.mp4`

Public demo: <https://crossready-build-week.vercel.app/>

The public build intentionally runs the bundled sample without an OpenAI API
key. The narration clearly separates that free reviewer flow from the measured,
controlled GPT-5.6 run shown near the end.

The recording preserves the earlier button labels **Load broken sample** and
**Run evidence audit**; the current build uses **Try the broken sample** and
**Run sample audit**.

## Final timeline and narration

| Time | Screen action | Final English narration |
|---|---|---|
| 0.0-9.5s | Hold on the CrossReady title and upload workspace. | A submission can fail even when every file is present, because the description, code, and report may quietly disagree. |
| 9.5-19.2s | Select **Load broken sample** and show `2 / 2 added`. | CrossReady checks those artifacts together. I'll load our intentionally broken sample: one rules file and one final ZIP. |
| 19.2-29.2s | Select **Run evidence audit** and show the free-sample label. | The public sample does not call GPT. It reads the bundled files and uses a verified answer key, so testing stays free. |
| 29.2-39.4s | Hold on the four result totals and `12 findings`. | The audit returns twelve findings: one proven, eight contradictions, one missing item, and two that need human review. |
| 39.4-46.1s | Open **Configured model contradicts submitted model**. | CrossReady does not ask us to trust a label. Let me open the first contradiction. |
| 46.1-63.4s | Highlight the four evidence cards in order. | Here, the description and README claim GPT-5.6, but the configuration and PDF say gpt-4.1-mini. This finding includes exact lines, page location, and quoted text from all four sources. |
| 63.4-76.7s | Close the dialog and show the Codex/build-safety card. | Codex helped build the schemas, safe ZIP scanner, evidence checks, cost guards, and sixty-four automated tests. Paid runs have no hidden retries, usage caps, cancellation, and clear errors. |
| 76.7-99.8s | Show the labeled, magnified real GPT-5.6 result capture. | In paid audits, GPT-5.6 extracts requirements and compares them across artifacts. This screenshot is a real controlled run, not the public sample: eleven files, sixteen findings, nine thousand thirty-eight tokens, and seventy-one point nine seconds. |
| 99.8-106.0s | Hold on the end card and public URL. | CrossReady is the final evidence check before you submit. |

## Completed production checks

- Duration is 1 minute 46.10 seconds, below the official three-minute limit.
- English AI narration and matching burned-in English captions are included.
- The public production URL is shown.
- The free public sample is explicitly labeled as not calling GPT.
- The actual paid GPT-5.6 run is shown as separate measured proof.
- Codex and GPT-5.6 roles are described concretely.
- The narrated count of 64 tests is correct for the recording time. Later
  consistency-hardening tests are reflected in the current verified total in
  the root README.
- No background music or third-party media was added.
- The end card holds the public URL for more than two seconds.
