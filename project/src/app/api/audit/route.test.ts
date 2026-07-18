import { readFile } from "node:fs/promises";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

async function sampleFiles() {
  const [rulesBytes, archiveBytes] = await Promise.all([
    readFile(path.resolve(process.cwd(), "../samples/challenge-rules.md")),
    readFile(
      path.resolve(
        process.cwd(),
        "../samples/CrossReady_Broken_Submission.zip",
      ),
    ),
  ]);

  return {
    rules: new File([rulesBytes], "challenge-rules.md", {
      type: "text/markdown",
    }),
    archive: new File(
      [archiveBytes],
      "CrossReady_Broken_Submission.zip",
      { type: "application/zip" },
    ),
  };
}

function auditRequest(
  rules: File,
  archive: File,
  demoMode: boolean,
): Request {
  const formData = new FormData();
  formData.append("rules", rules);
  formData.append("archive", archive);
  formData.append("demoMode", String(demoMode));

  return new Request("http://localhost/api/audit", {
    method: "POST",
    body: formData,
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/audit", () => {
  it("returns the fingerprint-gated sample result without calling GPT", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    const { rules, archive } = await sampleFiles();

    const response = await POST(auditRequest(rules, archive, true));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      ok: true,
      mode: "sample",
      model: null,
      inventory: {
        totalFiles: 11,
        manifest: { checked: 2, matches: 0 },
      },
    });
    expect(payload.requirements.requirements).toHaveLength(11);
    expect(payload.warnings.join(" ")).toContain("GPT-5.6 was not called");
  });

  it("falls back to an honest scanner-only result when no key exists", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    const { archive } = await sampleFiles();
    const rules = new File(
      [new TextEncoder().encode("# Rules\n\nThe demo must be public.")],
      "my-rules.md",
      { type: "text/markdown" },
    );

    const response = await POST(auditRequest(rules, archive, false));
    const payload = await response.json();

    expect(payload).toMatchObject({
      ok: true,
      mode: "scanner_only",
      model: null,
      requirements: null,
    });
    expect(payload.warnings.join(" ")).toContain("GPT-5.6 was not called");
  });

  it("does not let a changed file impersonate the bundled sample", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    const { rules, archive } = await sampleFiles();
    const changedRules = new File(
      [await rules.arrayBuffer(), new TextEncoder().encode("\n")],
      rules.name,
      { type: "text/markdown" },
    );

    const response = await POST(auditRequest(changedRules, archive, true));
    const payload = await response.json();

    expect(payload.mode).toBe("scanner_only");
    expect(payload.requirements).toBeNull();
    expect(payload.warnings.join(" ")).toContain(
      "did not match the bundled sample fingerprints",
    );
  });

  it("rejects an oversized multipart request before parsing its body", async () => {
    const response = await POST(
      new Request("http://localhost/api/audit", {
        method: "POST",
        headers: {
          "content-type": "multipart/form-data; boundary=crossready",
          "content-length": String(21 * 1024 * 1024),
        },
        body: "--crossready--",
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(413);
    expect(payload).toMatchObject({
      ok: false,
      error: { code: "REQUEST_TOO_LARGE" },
    });
  });
});
