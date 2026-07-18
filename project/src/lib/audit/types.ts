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

export type AuditMode = "live" | "sample" | "scanner_only";

export interface AuditSuccess {
  ok: true;
  mode: AuditMode;
  model: string | null;
  warnings: string[];
  inventory: ArchiveInventory;
  requirements: RequirementSet | null;
}

export interface AuditFailure {
  ok: false;
  error: {
    code: string;
    message: string;
  };
}

export type AuditResponse = AuditSuccess | AuditFailure;
