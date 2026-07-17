# Human Decision Log - 2026-07-18

This file records product decisions made by the human entrant. It is kept
separate from generated implementation details so judges can distinguish
product judgment from coding assistance.

## Decisions locked today

1. **Product:** CrossReady, an evidence-backed cross-artifact consistency
   auditor.
2. **Track:** Work & Productivity.
3. **Primary user:** a solo builder or small team preparing a high-stakes
   submission package.
4. **Core promise:** every finding must point to inspectable evidence.
5. **Authority boundary:** the product reports and explains; the user decides
   and edits.
6. **Model boundary:** GPT-5.6 performs semantic and multimodal extraction.
   Deterministic code owns byte-level and protocol-level facts.
7. **Demo strategy:** a fictional, intentionally inconsistent submission bundle
   provides a repeatable no-login test.
8. **Scope freeze:** no authentication, persistence, team collaboration,
   automatic fixes, or automatic submission before the judging build.

## Why this concept

The failure mode is not merely a missing field. High-stakes packages are
assembled from independent surfaces that can drift: a PDF, README, repository,
live product, video, and final description. CrossReady makes that hidden drift
visible and traceable.

## Success test

The project is demo-ready when a judge can load the sample, see at least five
real contradictions in under one minute, open the supporting evidence, and
understand why GPT-5.6 was required.
