import type { RequirementSet } from "./requirement-schema";

export type InventoryEntryKind =
  | "text"
  | "json"
  | "pdf"
  | "image"
  | "archive"
  | "binary";

export interface InventoryEntry {
  path: string;
  size: number;
  compressedSize: number;
  sha256: string;
  kind: InventoryEntryKind;
  preview?: string;
}

export interface ManifestMismatch {
  path: string;
  expected: string;
  actual: string | null;
  reason:
    | "hash_mismatch"
    | "missing_file"
    | "invalid_sha256"
    | "invalid_manifest"
    | "unsafe_manifest_path";
}

export interface ManifestResult {
  present: boolean;
  checked: number;
  matches: number;
  mismatches: ManifestMismatch[];
}

export interface ArchiveInventory {
  archiveName: string;
  archiveSha256: string;
  totalFiles: number;
  totalUncompressedBytes: number;
  entries: InventoryEntry[];
  manifest: ManifestResult;
}

export type AuditMode = "live" | "sample" | "partial" | "scanner_only";

export type FindingStatus =
  | "PROVEN"
  | "MISSING"
  | "CONTRADICTED"
  | "NEEDS_HUMAN";

export type FindingSeverity = "blocker" | "high" | "medium" | "low";

export interface AuditEvidence {
  artifactId: string;
  locatorType:
    | "page"
    | "line"
    | "section"
    | "url"
    | "frame"
    | "metadata"
    | "hash";
  locator: string;
  excerpt: string;
  factType: "deterministic" | "model_extracted" | "user_supplied";
}

export interface AuditFinding {
  id: string;
  requirementIds: string[];
  title: string;
  status: FindingStatus;
  severity: FindingSeverity;
  claim: string;
  explanation: string;
  evidence: AuditEvidence[];
  recommendedAction: string;
}

export interface AuditReport {
  schemaVersion: "1.0.0";
  auditId: string;
  createdAt: string;
  summary: {
    proven: number;
    missing: number;
    contradicted: number;
    needsHuman: number;
  };
  findings: AuditFinding[];
}

export interface ModelRunMetadata {
  model: string;
  responseId: string | null;
  durationMs: number;
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  } | null;
}

export type ModelFailureCode =
  | "auth"
  | "quota"
  | "rate_limit"
  | "timeout"
  | "server"
  | "refusal"
  | "invalid_output"
  | "request"
  | "unknown";

export interface PublicModelFailure {
  code: ModelFailureCode;
  message: string;
  retryable: boolean;
  requestId: string | null;
  action: string;
}

export interface AuditSuccess {
  ok: true;
  mode: AuditMode;
  model: string | null;
  warnings: string[];
  inventory: ArchiveInventory;
  requirements: RequirementSet | null;
  report: AuditReport | null;
  metadata: {
    requirementExtraction: ModelRunMetadata | null;
    crossAudit: ModelRunMetadata | null;
  } | null;
  modelFailure: PublicModelFailure | null;
  limits: {
    limit: number;
    remaining: number;
    resetAt: string;
  } | null;
}

export interface AuditFailure {
  ok: false;
  error: {
    code: string;
    message: string;
    retryable?: boolean;
    action?: string;
    requestId?: string | null;
    resetAt?: string;
  };
}

export type AuditResponse = AuditSuccess | AuditFailure;
