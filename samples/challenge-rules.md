# Northstar Workflow Challenge 2026

This is a fictional rules document created only for the CrossReady demo.

## Required technology

**REQ-001 - Model consistency (MUST, blocking).** The submitted product must
use GPT-5.6 for its core semantic audit. The model named in the submission
description, README, technical report, and runnable configuration must agree.

## Demo media

**REQ-002 - Public narrated demo (MUST, blocking).** The demo video must be
public, must contain an audio narration track, and must be shorter than 180
seconds.

## Quantified claims

**REQ-003 - Metric consistency (MUST, scored).** Evaluation sample counts and
quality metrics must be identical everywhere they appear.

## Final report

**REQ-004 - Current internal version (MUST, blocking).** The final technical
report must identify itself internally as version 3.0 or later. A filename
containing `FINAL` is not evidence of the internal version.

## Test access

**REQ-005 - Public demo URL (MUST, blocking).** A reviewer must be able to open
the submitted demo URL without an account or invitation.

## Package integrity

**REQ-006 - Manifest integrity (MUST, blocking).** Every SHA-256 value in the
package manifest must match the exact submitted file bytes.

## Product evidence

**REQ-007 - Evidence Graph (SHOULD, scored).** If the submission description
claims an Evidence Graph, the live-product evidence must visibly contain that
feature.

## Release identity

**REQ-008 - Build identity (MUST, blocking).** The build identifier in the
submission description, repository configuration, and live-product evidence
must identify the same release.

## Test claims

**REQ-009 - Test result accuracy (MUST, scored).** Claims about passing tests
must agree with the machine-readable test result generated from the submitted
commit.

## Human authority

**REQ-010 - Approval before changes (MUST, blocking).** The product must not
apply changes to submitted artifacts unless the user explicitly approves the
change.

## Reproducible review

**REQ-011 - Reviewer test path (SHOULD, scored).** The root README must include
a concrete action a reviewer can use to load or test the sample.
