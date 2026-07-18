import { describe, expect, it } from "vitest";
import { isAuditResponse } from "./response-guard";
import type { AuditFailure, AuditSuccess } from "./types";

function validSuccess(): AuditSuccess {
  return {
    ok: true,
    mode: "scanner_only",
    model: null,
    warnings: [],
    inventory: {
      archiveName: "submission.zip",
      archiveSha256: "a".repeat(64),
      totalFiles: 1,
      totalUncompressedBytes: 12,
      entries: [
        {
          path: "README.md",
          size: 12,
          compressedSize: 10,
          sha256: "b".repeat(64),
          kind: "text",
          preview: "hello",
        },
      ],
      manifest: {
        present: false,
        checked: 0,
        matches: 0,
        mismatches: [],
      },
    },
    requirements: null,
    report: null,
    metadata: null,
    modelFailure: null,
    limits: null,
  };
}

describe("isAuditResponse", () => {
  it("accepts a complete success response", () => {
    expect(isAuditResponse(validSuccess())).toBe(true);
  });

  it("rejects non-string warning entries before the UI renders them", () => {
    const response: unknown = {
      ...validSuccess(),
      warnings: [{}],
    };

    expect(isAuditResponse(response)).toBe(false);
  });

  it("rejects malformed nested inventory entries", () => {
    const response = structuredClone(validSuccess()) as unknown as {
      inventory: { entries: Array<Record<string, unknown>> };
    };
    response.inventory.entries[0].size = "twelve";

    expect(isAuditResponse(response)).toBe(false);
  });

  it("validates optional failure fields before the UI uses them", () => {
    const validFailure: AuditFailure = {
      ok: false,
      error: {
        code: "RATE_LIMITED",
        message: "Wait before retrying.",
        retryable: true,
        requestId: null,
      },
    };
    const invalidFailure: unknown = {
      ...validFailure,
      error: {
        ...validFailure.error,
        retryable: "yes",
      },
    };

    expect(isAuditResponse(validFailure)).toBe(true);
    expect(isAuditResponse(invalidFailure)).toBe(false);
  });
});
