# CrossReady final demo verification

Verified: 2026-07-19 KST

## Final artifact

- File: `submission/CrossReady_Demo_Final_106s.mp4`
- Size: 6,411,509 bytes
- SHA-256:
  `2AE563FE0F233E823593C8FE929205A55ADDED249A986AC33AC13868BAFCD4C3`
- Duration: 1 minute 46.10 seconds

## Media checks

- Video: H.264 High, 1600 x 900, 16:9, 25 fps, `yuv420p`
- Audio: AAC-LC, 48 kHz, stereo
- Audio level: mean -20.2 dB, maximum -1.5 dB
- English narration: present
- Burned-in English captions: present
- Background music: none
- Full video and audio decode: PASS, zero reported errors
- Beginning, evidence dialog, Codex card, GPT-5.6 proof, and end card:
  visually checked

## Three RSI review passes

1. **Rules and honesty:** clarified that the public sample does not call GPT;
   specified the concrete Codex and GPT-5.6 roles.
2. **Communication and readability:** verified the scene sequence and burned-in
   captions; normalized narration volume for clearer playback.
3. **Technical integrity:** found a 96 kHz intermediate audio stream, resampled
   it to standard 48 kHz, decoded the complete final file, and regenerated the
   final hash.

## Public YouTube verification

- Published URL: <https://youtu.be/IAyBWqYpfhw>
- Public title: `CrossReady — AI Submission Evidence Audit | OpenAI Build Week 2026`
- Verified without relying on the uploader's Studio session
- Visible in the public channel video list
- Public player duration: 1:46

The video URL was added to the Devpost project and the final submission was
completed:

- Devpost project: <https://devpost.com/software/crossready>
- Submission status verified as `Submitted` on 2026-07-19 KST
