# CrossReady production deployment record

## Public reviewer URL

- URL: <https://crossready-build-week.vercel.app/>
- Vercel project: `crossready-build-week`
- Project ID: `prj_hInUCuJgZaLiWWWUx6iu71w54xZY`
- Production deployment ID: `dpl_6cXKQY41nheRTenWjwJ3rjFpDUpR`
- Source commit: `3045e1f70fa58ab2667f7c0aff92aa1a59732ea3`
- Verified: 2026-07-18 KST

## Cost boundary

The production project has no environment variables and no
`OPENAI_API_KEY`. Public visitors can use the bundled sample flow but cannot
start a paid GPT request. The separately verified local GPT-5.6 path remains
available for the narrated demo and technical evidence.

## Controlled GPT-5.6 reviewer proof

One additional paid local audit was run on 2026-07-18 only to capture
reviewer-visible proof. It used the real rules file and broken submission ZIP,
not the saved public-sample answer key.

- API-returned model badge: `GPT-5.6-SOL`
- Files read: 11
- Final findings displayed: 16
- Status counts: 0 Proven, 4 Contradicted, 0 Missing, 12 Needs Human
- Total model usage displayed: 9,038 tokens
- Total elapsed time displayed: 71.9 seconds
- Remaining process-local run allowance after completion: 2 of 3
- Evidence image:
  `assets/screenshots/03-crossready-gpt56-live-result.png`

No retry or second click was made. The local proof server was stopped after the
screenshot, and the production deployment remains keyless.

## Deployment verification

- Vercel state: `READY`
- Framework: Next.js 16.2.10
- Production build: successful
- Public page title: `CrossReady — Evidence before submission`
- No-login access: confirmed
- Reviewer sample flow: confirmed
- Sample inventory: 11 files
- Sample findings: 12
- Status counts: 1 Proven, 8 Contradicted, 1 Missing, 2 Needs Human
- First finding dialog: four exact evidence records displayed
- Prepared PDF observations are labeled `준비된 샘플 정답`, while hashes
  remain labeled as directly calculated facts
- Browser console errors: 0
- Runtime error/fatal logs: 0
- Verified runtime responses: three HTTP 200 responses

## Reviewer path

1. Open the public URL.
2. Select **Load broken sample**.
3. Select **Run evidence audit**.
4. Open **Configured model contradicts submitted model**.
5. Review the four cited artifacts, exact locators, excerpts, and next action.

## Deployment correction retained for auditability

The first remote build completed while the new Vercel project still used the
generic static-site preset, so its alias returned `404 NOT_FOUND`. The project
framework was corrected to Next.js and that source was successfully
redeployed. The reviewer-ready source commit recorded above was later deployed
through the corrected Next.js configuration and is the current verified
production release.
