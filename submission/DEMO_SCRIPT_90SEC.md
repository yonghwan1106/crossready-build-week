# CrossReady 90-second demo script

Public demo: <https://crossready-build-week.vercel.app/>

The public build intentionally runs the bundled sample without an OpenAI API
key. The narration must not imply that the public sample is a paid GPT call.
The actual GPT-5.6 path was verified separately and is shown as measured proof.

## Shot list and narration

| Time | Screen action | Korean narration | English caption |
|---|---|---|---|
| 0-9s | Show the title and upload workspace. | "해커톤 제출물은 설명, 코드, 보고서가 조금만 달라도 심사 직전에 큰 문제가 됩니다. 하지만 사람이 모든 파일을 서로 비교하기는 어렵습니다." | A submission can fail when its description, code, and report disagree—even when every file exists. |
| 9-17s | Select **Load broken sample** and pause on `2 / 2 added`. | "CrossReady는 규정과 최종 제출 ZIP을 한곳에서 교차 검사합니다. 누구나 볼 수 있는 고장 난 샘플을 불러오겠습니다." | CrossReady cross-checks the rules and final submission ZIP in one workspace. |
| 17-25s | Select **Run evidence audit**. | "공개 데모는 비용이 들지 않도록 GPT를 호출하지 않고, 실제 샘플 파일을 읽어 검증된 정답표와 대조합니다." | The public sample is free: it reads the real files and uses a verified answer key without calling GPT. |
| 25-36s | Point to `1 / 8 / 1 / 2` and `12 findings`. | "몇 초 안에 확인 하나, 모순 여덟, 근거 없음 하나, 사람 확인 두 개—모두 열두 개의 판정이 나왔습니다." | 12 findings: 1 proven, 8 contradicted, 1 missing, and 2 needing human review. |
| 36-44s | Open **Configured model contradicts submitted model**. | "중요한 점은 결론만 믿으라고 하지 않는다는 것입니다. 첫 번째 모순을 직접 열어보겠습니다." | CrossReady never asks reviewers to trust a conclusion without evidence. |
| 44-61s | Move through the four evidence cards: description, README, config, PDF. | "설명과 README에는 GPT-5.6이라고 적혀 있지만, 설정 파일과 PDF에는 gpt-4.1-mini라고 적혀 있습니다. 파일명, 줄 번호, PDF 페이지와 원문까지 바로 확인할 수 있습니다." | The claim says GPT-5.6, while the configuration and PDF say gpt-4.1-mini. Every finding includes exact source locations and excerpts. |
| 61-72s | Close the dialog. Show a caption card: `Retries 0 · daily and concurrency limits · time and size limits`. | "유료 검사에는 자동 재시도를 끄고, 횟수와 동시 실행, 파일 크기와 시간을 제한했습니다. 인증, 결제, 시간 초과 오류도 쉬운 말로 보여줍니다." | Paid runs are protected by zero SDK retries, usage limits, cancellation, and clear errors. |
| 72-85s | Show `03-crossready-gpt56-live-result.png` for 5-10 seconds. Point to `GPT-5.6 LIVE`, `9,038 tokens`, `11 files`, and `16 findings`; briefly show the `gpt-5.6` model constant in code. | "Codex로 스키마, 검사기, 안전장치와 테스트 64개를 만들고 검증했습니다. 실제 GPT-5.6 검사는 열한 개 파일을 읽고 열여섯 개 판정을 만들었으며, 모델과 토큰 사용량도 화면에 그대로 남겼습니다." | Codex accelerated the implementation and 64-test verification. This controlled GPT-5.6 run read 11 files and displayed 16 findings with its real model and token usage. |
| 85-90s | Return to the product title or hold on the result screen. | "CrossReady는 제출 전에 모든 주장이 실제 근거와 일치하는지 보여주는 마지막 안전 점검입니다." | CrossReady: evidence before submission. |

## Recording checklist

- Keep the finished video below three minutes; this script targets 90 seconds.
- Include voice narration and English captions.
- Record the public production URL, not localhost.
- Pause for about one second on the four status counts and each evidence card.
- Label the measured GPT section **Actual GPT-5.6 local verification**.
- Include the real `GPT-5.6 live` result screen or API response badge, not only
  a manually typed statistics card.
- Do not claim that the public bundled sample itself calls GPT.
- Keep the mouse still while speaking; move only when the next item is named.
- End with the public URL visible for at least two seconds.

## Submission screenshots

- `assets/screenshots/01-crossready-public-results.png`
- `assets/screenshots/02-crossready-evidence-dialog.png`
- `assets/screenshots/03-crossready-gpt56-live-result.png`
