import { requirementSetSchema } from "./requirement-schema";
import type { AuditResponse } from "./types";

const AUDIT_MODES = new Set(["live", "sample", "partial", "scanner_only"]);
const ENTRY_KINDS = new Set([
  "text",
  "json",
  "pdf",
  "image",
  "archive",
  "binary",
]);
const MISMATCH_REASONS = new Set([
  "hash_mismatch",
  "missing_file",
  "invalid_sha256",
  "invalid_manifest",
  "unsafe_manifest_path",
]);
const FINDING_STATUSES = new Set([
  "PROVEN",
  "MISSING",
  "CONTRADICTED",
  "NEEDS_HUMAN",
]);
const FINDING_SEVERITIES = new Set(["blocker", "high", "medium", "low"]);
const LOCATOR_TYPES = new Set([
  "page",
  "line",
  "section",
  "url",
  "frame",
  "metadata",
  "hash",
]);
const FACT_TYPES = new Set([
  "deterministic",
  "model_extracted",
  "user_supplied",
]);
const MODEL_FAILURE_CODES = new Set([
  "auth",
  "quota",
  "rate_limit",
  "timeout",
  "server",
  "refusal",
  "invalid_output",
  "request",
  "unknown",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isOptionalString(value: unknown): boolean {
  return value === undefined || typeof value === "string";
}

function isInventoryEntry(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.path === "string" &&
    isFiniteNumber(value.size) &&
    isFiniteNumber(value.compressedSize) &&
    typeof value.sha256 === "string" &&
    typeof value.kind === "string" &&
    ENTRY_KINDS.has(value.kind) &&
    isOptionalString(value.preview)
  );
}

function isManifestMismatch(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.path === "string" &&
    typeof value.expected === "string" &&
    (value.actual === null || typeof value.actual === "string") &&
    typeof value.reason === "string" &&
    MISMATCH_REASONS.has(value.reason)
  );
}

function isManifest(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.present === "boolean" &&
    isFiniteNumber(value.checked) &&
    isFiniteNumber(value.matches) &&
    Array.isArray(value.mismatches) &&
    value.mismatches.every(isManifestMismatch)
  );
}

function isInventory(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.archiveName === "string" &&
    typeof value.archiveSha256 === "string" &&
    isFiniteNumber(value.totalFiles) &&
    isFiniteNumber(value.totalUncompressedBytes) &&
    Array.isArray(value.entries) &&
    value.entries.every(isInventoryEntry) &&
    isManifest(value.manifest)
  );
}

function isAuditEvidence(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.artifactId === "string" &&
    typeof value.locatorType === "string" &&
    LOCATOR_TYPES.has(value.locatorType) &&
    typeof value.locator === "string" &&
    typeof value.excerpt === "string" &&
    typeof value.factType === "string" &&
    FACT_TYPES.has(value.factType)
  );
}

function isAuditFinding(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    isStringArray(value.requirementIds) &&
    typeof value.title === "string" &&
    typeof value.status === "string" &&
    FINDING_STATUSES.has(value.status) &&
    typeof value.severity === "string" &&
    FINDING_SEVERITIES.has(value.severity) &&
    typeof value.claim === "string" &&
    typeof value.explanation === "string" &&
    Array.isArray(value.evidence) &&
    value.evidence.every(isAuditEvidence) &&
    typeof value.recommendedAction === "string"
  );
}

function hasNumericSummary(value: unknown): boolean {
  return (
    isRecord(value) &&
    isFiniteNumber(value.proven) &&
    isFiniteNumber(value.missing) &&
    isFiniteNumber(value.contradicted) &&
    isFiniteNumber(value.needsHuman)
  );
}

function isAuditReport(value: unknown): boolean {
  return (
    value === null ||
    (isRecord(value) &&
      value.schemaVersion === "1.0.0" &&
      typeof value.auditId === "string" &&
      typeof value.createdAt === "string" &&
      hasNumericSummary(value.summary) &&
      Array.isArray(value.findings) &&
      value.findings.every(isAuditFinding))
  );
}

function isModelUsage(value: unknown): boolean {
  return (
    value === null ||
    (isRecord(value) &&
      isFiniteNumber(value.inputTokens) &&
      isFiniteNumber(value.outputTokens) &&
      isFiniteNumber(value.totalTokens))
  );
}

function isModelRun(value: unknown): boolean {
  return (
    value === null ||
    (isRecord(value) &&
      typeof value.model === "string" &&
      (value.responseId === null || typeof value.responseId === "string") &&
      isFiniteNumber(value.durationMs) &&
      isModelUsage(value.usage))
  );
}

function isMetadata(value: unknown): boolean {
  return (
    value === null ||
    (isRecord(value) &&
      isModelRun(value.requirementExtraction) &&
      isModelRun(value.crossAudit))
  );
}

function isModelFailure(value: unknown): boolean {
  return (
    value === null ||
    (isRecord(value) &&
      typeof value.code === "string" &&
      MODEL_FAILURE_CODES.has(value.code) &&
      typeof value.message === "string" &&
      typeof value.retryable === "boolean" &&
      (value.requestId === null || typeof value.requestId === "string") &&
      typeof value.action === "string")
  );
}

function isLimits(value: unknown): boolean {
  return (
    value === null ||
    (isRecord(value) &&
      isFiniteNumber(value.limit) &&
      isFiniteNumber(value.remaining) &&
      typeof value.resetAt === "string")
  );
}

function isFailureError(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.code === "string" &&
    typeof value.message === "string" &&
    (value.retryable === undefined || typeof value.retryable === "boolean") &&
    isOptionalString(value.action) &&
    (value.requestId === undefined ||
      value.requestId === null ||
      typeof value.requestId === "string") &&
    isOptionalString(value.resetAt)
  );
}

export function isAuditResponse(value: unknown): value is AuditResponse {
  if (!isRecord(value) || typeof value.ok !== "boolean") return false;
  if (value.ok === false) return isFailureError(value.error);

  return (
    value.ok === true &&
    typeof value.mode === "string" &&
    AUDIT_MODES.has(value.mode) &&
    (value.model === null || typeof value.model === "string") &&
    isStringArray(value.warnings) &&
    isInventory(value.inventory) &&
    (value.requirements === null ||
      requirementSetSchema.safeParse(value.requirements).success) &&
    isAuditReport(value.report) &&
    isMetadata(value.metadata) &&
    isModelFailure(value.modelFailure) &&
    isLimits(value.limits)
  );
}
