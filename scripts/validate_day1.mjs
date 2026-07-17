import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { access, readFile, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

async function readJson(relativePath) {
  const text = await readFile(resolve(root, relativePath), "utf8");
  return JSON.parse(text);
}

async function sha256(relativePath) {
  const bytes = await readFile(resolve(root, relativePath));
  return createHash("sha256").update(bytes).digest("hex");
}

const requirementSchema = await readJson(
  "schemas/requirement-set.schema.json",
);
const auditSchema = await readJson("schemas/audit-report.schema.json");
const requirementSet = await readJson("samples/challenge-requirements.json");
const expected = await readJson("samples/expected-findings.json");
const manifest = await readJson(
  "samples/broken-submission/manifest.json",
);

assert.equal(
  requirementSchema.$schema,
  "https://json-schema.org/draft/2020-12/schema",
);
assert.equal(
  auditSchema.$schema,
  "https://json-schema.org/draft/2020-12/schema",
);

const requirementIds = requirementSet.requirements.map(({ id }) => id);
assert.equal(
  requirementIds.length,
  new Set(requirementIds).size,
  "Requirement IDs must be unique.",
);
assert.equal(requirementIds.length, 11, "The fixture must contain 11 rules.");

const allowedModalities = new Set(["MUST", "SHOULD", "MAY"]);
const allowedMethods = new Set([
  "deterministic",
  "semantic",
  "visual",
  "external",
  "human",
]);

for (const requirement of requirementSet.requirements) {
  assert.match(requirement.id, /^REQ-[0-9]{3}$/);
  assert.ok(requirement.statement.length > 0);
  assert.ok(allowedModalities.has(requirement.modality));
  assert.ok(requirement.expectedEvidence.length > 0);
  assert.ok(requirement.verificationMethods.length > 0);
  assert.ok(
    requirement.verificationMethods.every((method) =>
      allowedMethods.has(method),
    ),
  );
  assert.ok(requirement.source.excerpt.length > 0);
}

const findingIds = expected.expectedFindings.map(({ id }) => id);
assert.equal(
  findingIds.length,
  new Set(findingIds).size,
  "Finding IDs must be unique.",
);
assert.equal(findingIds.length, 12, "The answer key must contain 12 findings.");

const allowedStatuses = new Set([
  "PROVEN",
  "MISSING",
  "CONTRADICTED",
  "NEEDS_HUMAN",
]);

for (const finding of expected.expectedFindings) {
  assert.match(finding.id, /^FIND-[0-9]{3}$/);
  assert.ok(allowedStatuses.has(finding.status));
  assert.ok(finding.evidence.length > 0);
  assert.ok(
    finding.requirementIds.every((id) => requirementIds.includes(id)),
    `${finding.id} references an unknown requirement.`,
  );
}

const artifactRoot = "samples/broken-submission/";
for (const entry of manifest.files) {
  const relativePath = `${artifactRoot}${entry.path}`;
  await access(resolve(root, relativePath));
  const actualHash = await sha256(relativePath);
  assert.notEqual(
    actualHash,
    entry.sha256,
    `${entry.path} must remain intentionally inconsistent with the manifest.`,
  );
}

const zipPath = resolve(root, "samples/CrossReady_Broken_Submission.zip");
const zipInfo = await stat(zipPath);
assert.ok(zipInfo.size > 1_000, "The generated sample ZIP is unexpectedly small.");

const statusCounts = Object.fromEntries(
  [...allowedStatuses].map((status) => [
    status,
    expected.expectedFindings.filter((finding) => finding.status === status)
      .length,
  ]),
);

console.log("Day 1 validation passed.");
console.log(`Requirements: ${requirementIds.length}`);
console.log(`Expected findings: ${findingIds.length}`);
console.log(`Status counts: ${JSON.stringify(statusCounts)}`);
console.log(`Sample ZIP: ${zipInfo.size} bytes`);
