import { readFile } from "node:fs/promises";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  acquireAuditRequestSlot,
  consumeLiveAuditBudget,
  deriveAuditIdentity,
  resetLiveAuditBudgetForTests,
} from "@/lib/audit/cost-guard";
import {
  MAX_MULTIPART_BYTES,
  MAX_SUBMISSION_COPY_CHARACTERS,
  POST,
  startCrossAuditIfActive,
} from "./route";

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
  submissionCopy = "",
): Request {
  const formData = new FormData();
  formData.append("rules", rules);
  formData.append("archive", archive);
  formData.append("demoMode", String(demoMode));
  formData.append("submissionCopy", submissionCopy);

  return new Request("http://localhost/api/audit", {
    method: "POST",
    body: formData,
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
  resetLiveAuditBudgetForTests();
});

describe("POST /api/audit", () => {
  it("does not start the second paid call after the audit signal aborts", async () => {
    const controller = new AbortController();
    const crossCall = vi.fn(async () => "unexpected");
    controller.abort();

    await expect(
      startCrossAuditIfActive(controller.signal, crossCall),
    ).rejects.toMatchObject({
      code: "timeout",
      message: "The audit was cancelled before cross-audit started.",
    });
    expect(crossCall).not.toHaveBeenCalled();
  });

  it("rejects excess active requests before parsing multipart data", async () => {
    const first = acquireAuditRequestSlot();
    const second = acquireAuditRequestSlot();

    try {
      const response = await POST(
        new Request("http://localhost/api/audit", {
          method: "POST",
          headers: { "content-type": "text/plain" },
          body: "this body must not be parsed",
        }),
      );
      const payload = await response.json();

      expect(response.status).toBe(429);
      expect(payload).toMatchObject({
        ok: false,
        error: { code: "AUDIT_CAPACITY", retryable: true },
      });
    } finally {
      first.release();
      second.release();
    }
  });

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
    expect(payload.report).toMatchObject({
      summary: {
        proven: 1,
        missing: 1,
        contradicted: 8,
        needsHuman: 2,
      },
    });
    expect(payload.report.findings).toHaveLength(12);
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
      report: {
        summary: {
          contradicted: 1,
        },
      },
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

  it("also rejects a chunked oversized body without trusting content-length", async () => {
    const response = await POST(
      new Request("http://localhost/api/audit", {
        method: "POST",
        headers: {
          "content-type": "multipart/form-data; boundary=crossready",
        },
        body: new Uint8Array(MAX_MULTIPART_BYTES + 1),
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(413);
    expect(payload).toMatchObject({
      ok: false,
      error: { code: "REQUEST_TOO_LARGE" },
    });
  });

  it("rejects submission copy that exceeds the bounded text limit", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    const { rules, archive } = await sampleFiles();

    const response = await POST(
      auditRequest(
        rules,
        archive,
        false,
        "x".repeat(MAX_SUBMISSION_COPY_CHARACTERS + 1),
      ),
    );
    const payload = await response.json();

    expect(response.status).toBe(413);
    expect(payload).toMatchObject({
      ok: false,
      error: { code: "SUBMISSION_COPY_TOO_LARGE" },
    });
  });

  it("blocks a paid run before GPT when the client budget is exhausted", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-test-not-called");
    vi.stubEnv("CROSSREADY_LIVE_AUDIT_CLIENT_LIMIT", "1");
    vi.stubEnv("CROSSREADY_LIVE_AUDIT_DAILY_LIMIT", "100");
    const clientIp = "203.0.113.77";
    const identityRequest = new Request("http://localhost/api/audit", {
      headers: { "x-vercel-forwarded-for": clientIp },
    });
    const firstBudget = consumeLiveAuditBudget(
      deriveAuditIdentity(identityRequest),
    );
    expect(firstBudget.allowed).toBe(true);

    const { rules, archive } = await sampleFiles();
    const request = auditRequest(rules, archive, false);
    request.headers.set("x-vercel-forwarded-for", clientIp);
    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(429);
    expect(payload).toMatchObject({
      ok: false,
      error: {
        code: "RATE_LIMITED",
        retryable: true,
      },
    });
    expect(payload.error.resetAt).toMatch(/Z$/);
  });
});
