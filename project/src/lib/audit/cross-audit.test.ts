import { readFile } from "node:fs/promises";
import path from "node:path";

import OpenAI from "openai";
import { describe, expect, it, vi } from "vitest";

import northstarRequirements from "./fixtures/northstar-requirements.json";
import {
  createCanonicalSampleReport,
  crossAuditWithGpt,
} from "./cross-audit";
import { requirementSetSchema, type RequirementSet } from "./requirement-schema";
import { scanZipArchive } from "./scan-zip";
import type { ArchiveInventory } from "./types";

function requirements(
  statement = "The public claim must agree across submitted artifacts.",
  verificationMethods: Array<
    "deterministic" | "semantic" | "visual" | "external" | "human"
  > = ["semantic"],
): RequirementSet {
  return requirementSetSchema.parse({
    schemaVersion: "1.0.0",
    sourceArtifactId: "rules-123",
    sourceTitle: "Rules",
    requirements: [
      {
        id: "REQ-001",
        statement,
        modality: "MUST",
        scope: "submission",
        criticality: "blocking",
        condition: null,
        expectedEvidence: ["Submitted claims"],
        verificationMethods,
        source: {
          artifactId: "rules-123",
          locatorType: "section",
          locator: "Rule 1",
          excerpt: statement,
        },
      },
    ],
  });
}

function inventory(options: {
  manifestMismatch?: boolean;
} = {}): ArchiveInventory {
  return {
    archiveName: "submission.zip",
    archiveSha256: "a".repeat(64),
    totalFiles: 3,
    totalUncompressedBytes: 200,
    entries: [
      {
        path: "README.md",
        size: 80,
        compressedSize: 60,
        sha256: "b".repeat(64),
        kind: "text",
        preview: "README says the release is version 3.0 and publicly available.",
      },
      {
        path: "submission/description.md",
        size: 80,
        compressedSize: 60,
        sha256: "c".repeat(64),
        kind: "text",
        preview: "Submission says the release is version 2.0 and privately available.",
      },
      {
        path: "manifest.json",
        size: 40,
        compressedSize: 30,
        sha256: "d".repeat(64),
        kind: "json",
        preview: '{"files":[]}',
      },
    ],
    manifest: options.manifestMismatch
      ? {
          present: true,
          checked: 1,
          matches: 0,
          mismatches: [
            {
              path: "README.md",
              expected: "e".repeat(64),
              actual: "b".repeat(64),
              reason: "hash_mismatch",
            },
          ],
        }
      : {
          present: false,
          checked: 0,
          matches: 0,
          mismatches: [],
        },
  };
}

function fakeClient(findings: unknown[]) {
  const parse = vi.fn().mockResolvedValue({
    id: "resp_test_123",
    model: "gpt-5.6-2026-07-01",
    usage: {
      input_tokens: 100,
      output_tokens: 40,
      total_tokens: 140,
    },
    output: [],
    output_parsed: { findings },
  });
  return {
    client: { responses: { parse } } as unknown as OpenAI,
    parse,
  };
}

function modelFinding(
  overrides: Partial<{
    status: "PROVEN" | "MISSING" | "CONTRADICTED" | "NEEDS_HUMAN";
    evidence: Array<{
      artifactId: string;
      excerpt: string;
    }>;
    claim: string;
  }> = {},
) {
  return {
    requirementIds: ["REQ-001"],
    title: "Release claims disagree",
    status: overrides.status ?? "CONTRADICTED",
    severity: "blocker",
    claim: overrides.claim ?? "An exaggerated model-written claim.",
    explanation: "The two supplied claims conflict.",
    evidence:
      overrides.evidence ??
      [
        {
          artifactId: "README.md",
          excerpt: "release is version 3.0",
        },
        {
          artifactId: "submission/description.md",
          excerpt: "release is version 2.0",
        },
      ],
    recommendedAction: "Align the release claims.",
  };
}

describe("crossAuditWithGpt", () => {
  it("keeps a contradiction only when two exact allowlisted excerpts verify it", async () => {
    const { client, parse } = fakeClient([modelFinding()]);
    const inputRequirements = requirements();

    const result = await crossAuditWithGpt(
      {
        requirements: inputRequirements,
        inventory: inventory(),
        safetyIdentifier: "cr_test",
      },
      client,
    );

    expect(result.report.findings[0]).toMatchObject({
      status: "CONTRADICTED",
      claim: inputRequirements.requirements[0].statement,
    });
    expect(result.report.findings[0].evidence).toHaveLength(2);
    expect(result.report.findings[0].evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          artifactId: "README.md",
          locatorType: "line",
          locator: "line 1",
        }),
      ]),
    );
    expect(result.metadata).toMatchObject({
      model: "gpt-5.6-2026-07-01",
      responseId: "resp_test_123",
      usage: { totalTokens: 140 },
    });
    expect(result.metadata.durationMs).toBeGreaterThanOrEqual(0);
    expect(parse.mock.calls[0]?.[0]).toMatchObject({
      safety_identifier: "cr_test",
      max_output_tokens: 7_000,
      store: false,
      text: { verbosity: "low" },
    });
  });

  it("merges consistent duplicate findings without inflating the summary", async () => {
    const duplicate = modelFinding({
      status: "PROVEN",
      evidence: [
        {
          artifactId: "README.md",
          excerpt: "release is version 3.0",
        },
      ],
    });
    const { client } = fakeClient([duplicate, duplicate]);

    const result = await crossAuditWithGpt(
      { requirements: requirements(), inventory: inventory() },
      client,
    );

    expect(result.report.findings).toHaveLength(1);
    expect(result.report.findings[0]).toMatchObject({
      requirementIds: ["REQ-001"],
      status: "PROVEN",
    });
    expect(result.report.findings[0].evidence).toHaveLength(1);
    expect(result.report.summary).toEqual({
      proven: 1,
      missing: 0,
      contradicted: 0,
      needsHuman: 0,
    });
  });

  it("merges conflicting duplicate statuses into one human-review finding", async () => {
    const { client } = fakeClient([
      modelFinding({
        status: "PROVEN",
        evidence: [
          {
            artifactId: "README.md",
            excerpt: "release is version 3.0",
          },
        ],
      }),
      modelFinding({ status: "CONTRADICTED" }),
    ]);

    const result = await crossAuditWithGpt(
      { requirements: requirements(), inventory: inventory() },
      client,
    );

    expect(result.report.findings).toHaveLength(1);
    expect(result.report.findings[0].status).toBe("NEEDS_HUMAN");
    expect(result.report.findings[0].explanation).toContain(
      "conflicting statuses",
    );
    expect(result.report.summary.needsHuman).toBe(1);
  });

  it("forces external, visual, or human verification methods to human review", async () => {
    const { client } = fakeClient([
      modelFinding({
        status: "PROVEN",
        evidence: [
          {
            artifactId: "README.md",
            excerpt: "release is version 3.0",
          },
        ],
      }),
    ]);

    const result = await crossAuditWithGpt(
      {
        requirements: requirements(
          "The public release must be externally reachable.",
          ["semantic", "external"],
        ),
        inventory: inventory(),
      },
      client,
    );

    expect(result.report.findings[0].status).toBe("NEEDS_HUMAN");
    expect(result.report.findings[0].explanation).toContain(
      "external, visual, or human verification",
    );
  });

  it("downgrades unknown or non-exact evidence to NEEDS_HUMAN", async () => {
    const { client } = fakeClient([
      modelFinding({
        evidence: [
          {
            artifactId: "not-in-the-zip.md",
            excerpt: "This excerpt never appeared anywhere.",
          },
        ],
      }),
    ]);

    const result = await crossAuditWithGpt(
      { requirements: requirements(), inventory: inventory() },
      client,
    );

    expect(result.report.findings[0].status).toBe("NEEDS_HUMAN");
    expect(result.report.findings[0].evidence[0]).toMatchObject({
      artifactId: "crossready-audit",
      factType: "deterministic",
    });
  });

  it("downgrades a one-artifact model contradiction", async () => {
    const { client } = fakeClient([
      modelFinding({
        evidence: [
          {
            artifactId: "README.md",
            excerpt: "release is version 3.0",
          },
        ],
      }),
    ]);

    const result = await crossAuditWithGpt(
      { requirements: requirements(), inventory: inventory() },
      client,
    );

    expect(result.report.findings[0].status).toBe("NEEDS_HUMAN");
  });

  it("does not claim evidence is missing when a binary artifact was unavailable", async () => {
    const incompleteInventory = inventory();
    incompleteInventory.totalFiles += 1;
    incompleteInventory.entries.push({
      path: "technical-report.pdf",
      size: 500,
      compressedSize: 400,
      sha256: "f".repeat(64),
      kind: "pdf",
    });
    const { client } = fakeClient([
      modelFinding({
        status: "MISSING",
        evidence: [
          {
            artifactId: "README.md",
            excerpt: "publicly available",
          },
        ],
      }),
    ]);

    const result = await crossAuditWithGpt(
      { requirements: requirements(), inventory: incompleteInventory },
      client,
    );

    expect(result.report.findings[0].status).toBe("NEEDS_HUMAN");
  });

  it("preserves submission copy as user-supplied evidence", async () => {
    const { client } = fakeClient([
      modelFinding({
        status: "PROVEN",
        evidence: [
          {
            artifactId: "submission-copy",
            excerpt: "Public launch confirmed",
          },
        ],
      }),
    ]);

    const result = await crossAuditWithGpt(
      {
        requirements: requirements(),
        inventory: inventory(),
        submissionCopy: "Public launch confirmed",
      },
      client,
    );

    expect(result.report.findings[0].evidence[0].factType).toBe(
      "user_supplied",
    );
  });

  it("overrides the model with deterministic manifest hash facts", async () => {
    const manifestRequirements = requirements(
      "Every SHA-256 value in manifest.json must match the submitted bytes.",
    );
    const { client } = fakeClient([
      modelFinding({ status: "PROVEN", claim: "All hashes match." }),
    ]);

    const result = await crossAuditWithGpt(
      {
        requirements: manifestRequirements,
        inventory: inventory({ manifestMismatch: true }),
      },
      client,
    );

    expect(result.report.findings).toHaveLength(1);
    expect(result.report.findings[0]).toMatchObject({
      status: "CONTRADICTED",
      title: "Manifest integrity",
      evidence: [{ factType: "deterministic" }],
    });
  });

  it("points invalid manifest evidence to the real manifest file", async () => {
    const invalidInventory = inventory();
    invalidInventory.manifest = {
      present: true,
      checked: 0,
      matches: 0,
      mismatches: [
        {
          path: "untrusted/path.txt",
          expected: "",
          actual: null,
          reason: "invalid_manifest",
        },
      ],
    };
    const { client } = fakeClient([
      modelFinding({ status: "PROVEN", claim: "The manifest is valid." }),
    ]);

    const result = await crossAuditWithGpt(
      {
        requirements: requirements(
          "manifest.json must contain valid SHA-256 entries.",
        ),
        inventory: invalidInventory,
      },
      client,
    );

    expect(result.report.findings[0]).toMatchObject({
      status: "CONTRADICTED",
      explanation:
        "1 manifest validation issue(s): manifest.json could not be parsed as a valid file map.",
      evidence: [
        {
          artifactId: "manifest.json",
          locatorType: "metadata",
          locator: "manifest entry for untrusted/path.txt",
          factType: "deterministic",
        },
      ],
    });
  });

  it("preserves an unmatched deterministic manifest finding as package integrity", async () => {
    const { client } = fakeClient([
      modelFinding({
        status: "PROVEN",
        evidence: [
          {
            artifactId: "README.md",
            excerpt: "release is version 3.0",
          },
        ],
      }),
    ]);

    const result = await crossAuditWithGpt(
      {
        requirements: requirements(),
        inventory: inventory({ manifestMismatch: true }),
      },
      client,
    );

    expect(result.report.findings).toHaveLength(2);
    expect(result.report.findings[0]).toMatchObject({
      requirementIds: ["REQ-001"],
      status: "PROVEN",
    });
    expect(result.report.findings[1]).toMatchObject({
      requirementIds: [],
      title: "Manifest integrity",
      status: "CONTRADICTED",
    });
  });
});

describe("createCanonicalSampleReport", () => {
  it("returns all 12 complete answer-key findings and the expected summary", async () => {
    const archiveBytes = new Uint8Array(
      await readFile(
        path.resolve(
          process.cwd(),
          "../samples/CrossReady_Broken_Submission.zip",
        ),
      ),
    );
    const sampleInventory = await scanZipArchive(
      "CrossReady_Broken_Submission.zip",
      archiveBytes,
    );

    const report = createCanonicalSampleReport(
      requirementSetSchema.parse(northstarRequirements),
      sampleInventory,
    );

    expect(report.findings).toHaveLength(12);
    expect(report.summary).toEqual({
      proven: 1,
      missing: 1,
      contradicted: 8,
      needsHuman: 2,
    });
    expect(
      report.findings.every(
        (finding) =>
          finding.evidence.length > 0 &&
          finding.evidence.every(
            (evidence) =>
              evidence.artifactId &&
              evidence.locator &&
              evidence.excerpt &&
              evidence.factType,
          ),
      ),
    ).toBe(true);

    const pdfEvidence = report.findings.flatMap((finding) =>
      finding.evidence.filter(
        (evidence) =>
          evidence.artifactId ===
          "docs/technical-overview_FINAL_v3.pdf",
      ),
    );
    expect(pdfEvidence.length).toBeGreaterThan(0);
    const pdfPageEvidence = pdfEvidence.filter(
      (evidence) => evidence.locatorType === "page",
    );
    expect(
      pdfPageEvidence.every(
        (evidence) =>
          evidence.factType === "sample_answer" &&
          !/^size=\d+;\s*sha256=/i.test(evidence.excerpt),
      ),
    ).toBe(true);
    expect(
      pdfEvidence
        .filter((evidence) => evidence.locatorType === "hash")
        .every((evidence) => evidence.factType === "deterministic"),
    ).toBe(true);
    expect(pdfEvidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          locator: "page 1 text layer",
          excerpt:
            "Document version 2.1 - prepared before the final evaluation run.",
        }),
        expect.objectContaining({
          locator: "page 2 rendered image",
          excerpt: expect.stringContaining("visible rendered pixels"),
        }),
      ]),
    );
    expect(
      report.findings.every(
        (finding) =>
          finding.evidence.every(
            (evidence) =>
              !evidence.artifactId.startsWith(
                "crossready-sample-answer-key",
              ),
          ),
      ),
    ).toBe(true);
  });
});
