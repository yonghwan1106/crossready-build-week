import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  TextReader,
  Uint8ArrayReader,
  Uint8ArrayWriter,
  ZipWriter,
} from "@zip.js/zip.js";
import { describe, expect, it } from "vitest";

import { AuditInputError } from "./errors";
import {
  assertSafeArchivePath,
  scanZipArchive,
  ZIP_LIMITS,
} from "./scan-zip";

async function makeZip(
  files: Array<{ path: string; text?: string; bytes?: Uint8Array }>,
): Promise<Uint8Array> {
  const writer = new ZipWriter(new Uint8ArrayWriter());
  for (const file of files) {
    if (file.bytes) {
      await writer.add(file.path, new Uint8ArrayReader(file.bytes));
    } else {
      await writer.add(file.path, new TextReader(file.text ?? ""));
    }
  }
  return writer.close();
}

describe("scanZipArchive", () => {
  it("reads the bundled broken sample and proves its manifest mismatches", async () => {
    const bytes = new Uint8Array(
      await readFile(
        path.resolve(
          process.cwd(),
          "../samples/CrossReady_Broken_Submission.zip",
        ),
      ),
    );

    const inventory = await scanZipArchive(
      "CrossReady_Broken_Submission.zip",
      bytes,
    );

    expect(inventory.archiveSha256).toBe(
      "f899c4b4174897f69b1be94fa29631f15490fb3f9625ad3bdc1eccbd32370d93",
    );
    expect(inventory.totalFiles).toBe(11);
    expect(inventory.entries).toHaveLength(11);
    expect(inventory.entries.every((entry) => /^[a-f0-9]{64}$/.test(entry.sha256))).toBe(
      true,
    );
    expect(inventory.manifest).toMatchObject({
      present: true,
      checked: 2,
      matches: 0,
    });
    expect(inventory.manifest.mismatches).toHaveLength(2);
    expect(
      inventory.manifest.mismatches.every(
        (mismatch) => mismatch.reason === "hash_mismatch",
      ),
    ).toBe(true);
    expect(
      inventory.entries.find((entry) => entry.path === "README.md")?.preview,
    ).toContain("CrossReady");
  });

  it("accepts a manifest whose SHA-256 matches the exact file bytes", async () => {
    const content = "hello CrossReady";
    const expected = createHash("sha256").update(content).digest("hex");
    const bytes = await makeZip([
      { path: "README.md", text: content },
      {
        path: "manifest.json",
        text: JSON.stringify({
          files: [{ path: "README.md", sha256: expected }],
        }),
      },
    ]);

    const inventory = await scanZipArchive("submission.zip", bytes);

    expect(inventory.manifest).toEqual({
      present: true,
      checked: 1,
      matches: 1,
      mismatches: [],
      unlistedPaths: [],
    });
  });

  it("tracks ZIP files omitted from the manifest without counting manifest.json itself", async () => {
    const content = "hello CrossReady";
    const expected = createHash("sha256").update(content).digest("hex");
    const bytes = await makeZip([
      { path: "README.md", text: content },
      { path: "evidence/omitted.txt", text: "not listed in manifest" },
      {
        path: "manifest.json",
        text: JSON.stringify({
          files: [{ path: "README.md", sha256: expected }],
        }),
      },
    ]);

    const inventory = await scanZipArchive("submission.zip", bytes);

    expect(inventory.manifest).toMatchObject({
      present: true,
      checked: 1,
      matches: 1,
      mismatches: [],
      unlistedPaths: ["evidence/omitted.txt"],
    });
  });

  it("does not present an empty manifest as a verified success", async () => {
    const bytes = await makeZip([
      { path: "README.md", text: "hello CrossReady" },
      { path: "manifest.json", text: JSON.stringify({ files: [] }) },
    ]);

    const inventory = await scanZipArchive("submission.zip", bytes);

    expect(inventory.manifest).toEqual({
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
      unlistedPaths: ["README.md"],
    });
  });

  it("rejects an entry before extraction when its declared size is too large", async () => {
    const bytes = await makeZip([
      {
        path: "oversized.txt",
        bytes: new Uint8Array(ZIP_LIMITS.maxEntryBytes + 1),
      },
    ]);

    await expect(scanZipArchive("submission.zip", bytes)).rejects.toMatchObject({
      code: "ENTRY_TOO_LARGE",
      status: 413,
    });
  });
});

describe("assertSafeArchivePath", () => {
  it.each([
    "../escape.txt",
    "safe/../escape.txt",
    "/absolute.txt",
    "C:/windows.txt",
    "\\\\server\\share.txt",
    "safe\\windows.txt",
    "./dot.txt",
    "safe//double.txt",
    "safe/\0nul.txt",
  ])("rejects unsafe ZIP path %s", (filename) => {
    expect(() => assertSafeArchivePath(filename)).toThrow(AuditInputError);
  });

  it("accepts a normal nested relative path", () => {
    expect(() => assertSafeArchivePath("repository/src/config.ts")).not.toThrow();
  });
});
