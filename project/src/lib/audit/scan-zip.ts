import { createHash } from "node:crypto";
import path from "node:path";

import { type Entry, Uint8ArrayReader, ZipReader } from "@zip.js/zip.js";

import { AuditInputError } from "./errors";
import type {
  ArchiveInventory,
  InventoryEntryKind,
  ManifestMismatch,
  ManifestResult,
} from "./types";

export const ZIP_LIMITS = {
  maxArchiveBytes: 10 * 1024 * 1024,
  maxEntries: 150,
  maxFiles: 100,
  maxTotalUncompressedBytes: 25 * 1024 * 1024,
  maxEntryBytes: 2 * 1024 * 1024,
  maxPreviewCharacters: 1_200,
} as const;

const TEXT_EXTENSIONS = new Set([
  ".css",
  ".csv",
  ".html",
  ".htm",
  ".js",
  ".jsx",
  ".json",
  ".md",
  ".mjs",
  ".cjs",
  ".toml",
  ".ts",
  ".tsx",
  ".txt",
  ".xml",
  ".yaml",
  ".yml",
]);

const IMAGE_EXTENSIONS = new Set([
  ".avif",
  ".gif",
  ".jpeg",
  ".jpg",
  ".png",
  ".svg",
  ".webp",
]);

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function assertSafeArchivePath(filename: string): void {
  if (!filename || filename.includes("\0")) {
    throw new AuditInputError(
      "UNSAFE_ARCHIVE_PATH",
      "The ZIP contains an empty filename or a NUL character.",
    );
  }

  if (
    filename.includes("\\") ||
    filename.startsWith("/") ||
    filename.startsWith("//") ||
    /^[A-Za-z]:/.test(filename)
  ) {
    throw new AuditInputError(
      "UNSAFE_ARCHIVE_PATH",
      `The ZIP contains an unsafe absolute or Windows-style path: ${filename}`,
    );
  }

  const segments = filename.split("/");
  if (
    segments.some(
      (segment) =>
        segment === "" ||
        segment === "." ||
        segment === ".." ||
        /[\u0000-\u001f\u007f]/.test(segment),
    )
  ) {
    throw new AuditInputError(
      "UNSAFE_ARCHIVE_PATH",
      `The ZIP contains an unsafe relative path: ${filename}`,
    );
  }
}

function kindFor(filename: string): InventoryEntryKind {
  const extension = path.posix.extname(filename).toLowerCase();
  if (extension === ".json") return "json";
  if (TEXT_EXTENSIONS.has(extension)) return "text";
  if (extension === ".pdf") return "pdf";
  if (IMAGE_EXTENSIONS.has(extension)) return "image";
  if (extension === ".zip") return "archive";
  return "binary";
}

function previewFor(bytes: Uint8Array, kind: InventoryEntryKind): string | undefined {
  if (kind !== "text" && kind !== "json") return undefined;

  const decoded = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  const normalized = decoded.replace(/\r\n/g, "\n").replace(/\0/g, "�");
  return normalized.slice(0, ZIP_LIMITS.maxPreviewCharacters);
}

interface ManifestFileClaim {
  path: string;
  sha256: string;
}

function parseManifestClaims(manifestBytes: Uint8Array): ManifestFileClaim[] | null {
  try {
    const decoded = new TextDecoder("utf-8", { fatal: true }).decode(
      manifestBytes,
    );
    const parsed: unknown = JSON.parse(decoded);
    if (!parsed || typeof parsed !== "object" || !("files" in parsed)) return null;

    const files = (parsed as { files?: unknown }).files;
    if (!Array.isArray(files) || files.length === 0) return null;

    const claims: ManifestFileClaim[] = [];
    const claimedPaths = new Set<string>();
    for (const item of files) {
      if (
        !item ||
        typeof item !== "object" ||
        typeof (item as { path?: unknown }).path !== "string" ||
        typeof (item as { sha256?: unknown }).sha256 !== "string"
      ) {
        return null;
      }
      const claimedPath = (item as { path: string }).path;
      const foldedPath = claimedPath.normalize("NFC").toLocaleLowerCase("en-US");
      if (claimedPaths.has(foldedPath)) return null;
      claimedPaths.add(foldedPath);
      claims.push({
        path: claimedPath,
        sha256: (item as { sha256: string }).sha256,
      });
    }
    return claims;
  } catch {
    return null;
  }
}

function checkManifest(
  manifestBytes: Uint8Array | null,
  entryHashes: ReadonlyMap<string, string>,
): ManifestResult {
  const submittedPaths = [...entryHashes.keys()]
    .filter((entryPath) => entryPath !== "manifest.json")
    .sort((left, right) => left.localeCompare(right));

  if (!manifestBytes) {
    return {
      present: false,
      checked: 0,
      matches: 0,
      mismatches: [],
      unlistedPaths: submittedPaths,
    };
  }

  const claims = parseManifestClaims(manifestBytes);
  if (!claims) {
    return {
      present: true,
      checked: 0,
      matches: 0,
      mismatches: [
        {
          path: "manifest.json",
          expected: "",
          actual: null,
          reason: "invalid_manifest",
        },
      ],
      unlistedPaths: submittedPaths,
    };
  }

  let matches = 0;
  const mismatches: ManifestMismatch[] = [];
  const listedPaths = new Set<string>();

  for (const claim of claims) {
    const expected = claim.sha256.toLowerCase();
    try {
      assertSafeArchivePath(claim.path);
    } catch {
      mismatches.push({
        path: claim.path,
        expected,
        actual: null,
        reason: "unsafe_manifest_path",
      });
      continue;
    }
    listedPaths.add(claim.path);

    if (!/^[a-f0-9]{64}$/.test(expected)) {
      mismatches.push({
        path: claim.path,
        expected,
        actual: entryHashes.get(claim.path) ?? null,
        reason: "invalid_sha256",
      });
      continue;
    }

    const actual = entryHashes.get(claim.path) ?? null;
    if (actual === null) {
      mismatches.push({
        path: claim.path,
        expected,
        actual,
        reason: "missing_file",
      });
    } else if (actual !== expected) {
      mismatches.push({
        path: claim.path,
        expected,
        actual,
        reason: "hash_mismatch",
      });
    } else {
      matches += 1;
    }
  }

  return {
    present: true,
    checked: claims.length,
    matches,
    mismatches,
    unlistedPaths: submittedPaths.filter(
      (submittedPath) => !listedPaths.has(submittedPath),
    ),
  };
}

export async function scanZipArchive(
  archiveName: string,
  archiveBytes: Uint8Array,
): Promise<ArchiveInventory> {
  if (!archiveName.toLowerCase().endsWith(".zip")) {
    throw new AuditInputError("ARCHIVE_TYPE", "The submission archive must be a ZIP file.");
  }
  if (archiveBytes.byteLength === 0) {
    throw new AuditInputError("EMPTY_ARCHIVE", "The submitted ZIP is empty.");
  }
  if (archiveBytes.byteLength > ZIP_LIMITS.maxArchiveBytes) {
    throw new AuditInputError(
      "ARCHIVE_TOO_LARGE",
      `The ZIP exceeds the ${ZIP_LIMITS.maxArchiveBytes / 1024 / 1024} MiB limit.`,
      413,
    );
  }

  const archiveSha256 = sha256(archiveBytes);
  const reader = new ZipReader(new Uint8ArrayReader(archiveBytes), {
    checkSignature: true,
  });

  try {
    const allEntries: Entry[] = [];
    for await (const entry of reader.getEntriesGenerator()) {
      if (allEntries.length >= ZIP_LIMITS.maxEntries) {
        throw new AuditInputError(
          "TOO_MANY_ENTRIES",
          `The ZIP contains more than ${ZIP_LIMITS.maxEntries} entries.`,
          413,
        );
      }
      allEntries.push(entry);
    }
    const fileEntries = allEntries.filter((entry) => !entry.directory);

    const seenPaths = new Set<string>();
    for (const entry of allEntries) {
      const candidatePath =
        entry.directory && entry.filename.endsWith("/")
          ? entry.filename.slice(0, -1)
          : entry.filename;
      assertSafeArchivePath(candidatePath);

      const foldedPath = candidatePath
        .normalize("NFC")
        .toLocaleLowerCase("en-US");
      if (seenPaths.has(foldedPath)) {
        throw new AuditInputError(
          "DUPLICATE_ARCHIVE_PATH",
          `The ZIP contains a duplicate path: ${entry.filename}`,
        );
      }
      seenPaths.add(foldedPath);

      if (entry.encrypted) {
        throw new AuditInputError(
          "ENCRYPTED_ENTRY",
          `Encrypted ZIP entries are not supported: ${entry.filename}`,
        );
      }
    }

    if (fileEntries.length > ZIP_LIMITS.maxFiles) {
      throw new AuditInputError(
        "TOO_MANY_FILES",
        `The ZIP contains more than ${ZIP_LIMITS.maxFiles} files.`,
        413,
      );
    }

    let totalUncompressedBytes = 0;

    for (const entry of fileEntries) {
      if (entry.uncompressedSize > ZIP_LIMITS.maxEntryBytes) {
        throw new AuditInputError(
          "ENTRY_TOO_LARGE",
          `A ZIP entry exceeds the ${ZIP_LIMITS.maxEntryBytes / 1024 / 1024} MiB limit: ${entry.filename}`,
          413,
        );
      }

      totalUncompressedBytes += entry.uncompressedSize;
      if (totalUncompressedBytes > ZIP_LIMITS.maxTotalUncompressedBytes) {
        throw new AuditInputError(
          "UNCOMPRESSED_ARCHIVE_TOO_LARGE",
          `The expanded ZIP exceeds the ${ZIP_LIMITS.maxTotalUncompressedBytes / 1024 / 1024} MiB limit.`,
          413,
        );
      }
    }

    const entries = [];
    const entryHashes = new Map<string, string>();
    let manifestBytes: Uint8Array | null = null;

    for (const entry of fileEntries) {
      const bytes = new Uint8Array(
        await entry.arrayBuffer({ checkSignature: true }),
      );
      if (bytes.byteLength !== entry.uncompressedSize) {
        throw new AuditInputError(
          "ENTRY_SIZE_MISMATCH",
          `A ZIP entry size did not match its directory record: ${entry.filename}`,
        );
      }

      const entrySha256 = sha256(bytes);
      const kind = kindFor(entry.filename);
      const preview = previewFor(bytes, kind);
      entryHashes.set(entry.filename, entrySha256);

      if (entry.filename === "manifest.json") {
        manifestBytes = bytes;
      }

      entries.push({
        path: entry.filename,
        size: entry.uncompressedSize,
        compressedSize: entry.compressedSize,
        sha256: entrySha256,
        kind,
        ...(preview ? { preview } : {}),
      });
    }

    entries.sort((left, right) => left.path.localeCompare(right.path));

    return {
      archiveName,
      archiveSha256,
      totalFiles: fileEntries.length,
      totalUncompressedBytes,
      entries,
      manifest: checkManifest(manifestBytes, entryHashes),
    };
  } catch (error) {
    if (error instanceof AuditInputError) throw error;
    throw new AuditInputError(
      "INVALID_ZIP",
      "The submitted file could not be read as a valid ZIP archive.",
    );
  } finally {
    await reader.close().catch(() => undefined);
  }
}
