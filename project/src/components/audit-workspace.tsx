"use client";

import { useRef, useState, type ChangeEvent, type FormEvent } from "react";

type InventoryEntry = {
  path: string;
  size: number;
  compressedSize: number;
  sha256: string;
  kind: string;
  preview?: string;
};

type ManifestMismatch = {
  path: string;
  expected: string;
  actual: string | null;
  reason: string;
};

type Inventory = {
  archiveName: string;
  archiveSha256: string;
  totalFiles: number;
  totalUncompressedBytes: number;
  entries: InventoryEntry[];
  manifest: {
    present: boolean;
    checked: number;
    matches: number;
    mismatches: ManifestMismatch[];
  };
};

type Requirement = {
  id: string;
  statement: string;
  modality: string;
  scope: string;
  criticality: string;
  condition: string | null;
  expectedEvidence: string[];
  verificationMethods: string[];
  source: {
    artifactId: string;
    locatorType: string;
    locator: string;
    excerpt: string;
  };
};

type RequirementSet = {
  schemaVersion: string;
  sourceArtifactId: string;
  sourceTitle: string;
  requirements: Requirement[];
};

type AuditSuccess = {
  ok: true;
  mode: "live" | "sample" | "scanner_only";
  model: string | null;
  warnings: string[];
  inventory: Inventory;
  requirements: RequirementSet | null;
};

type AuditFailure = {
  ok: false;
  error: {
    code: string;
    message: string;
  };
};

type AuditResponse = AuditSuccess | AuditFailure;

function UploadIcon({ kind }: { kind: "rules" | "archive" | "upload" | "scan" }) {
  const path =
    kind === "rules" ? (
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6M8 13h8M8 17h5" />
      </>
    ) : kind === "archive" ? (
      <>
        <path d="M4 7h16M5 7v12h14V7M3 3h18v4H3zM9 11h6" />
      </>
    ) : kind === "scan" ? (
      <>
        <path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3" />
        <path d="M7 12h10M12 7v10" />
      </>
    ) : (
      <>
        <path d="M12 16V4M7 9l5-5 5 5M4 20h16" />
      </>
    );

  return (
    <svg
      aria-hidden="true"
      className="size-[18px]"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {path}
    </svg>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function shortHash(hash: string) {
  return hash.length > 12 ? `${hash.slice(0, 12)}…` : hash;
}

function modeLabel(result: AuditSuccess) {
  if (result.mode === "live") {
    return {
      title: "GPT-5.6 live",
      detail: result.model ?? "GPT-5.6",
      className: "bg-accent/10 text-accent ring-accent/25",
    };
  }

  if (result.mode === "sample") {
    return {
      title: "Sample data",
      detail: "Bundled demo files",
      className: "bg-sky-400/10 text-sky-300 ring-sky-300/25",
    };
  }

  return {
    title: "File scan only",
    detail: "GPT extraction skipped",
    className: "bg-amber-300/10 text-amber-200 ring-amber-200/25",
  };
}

function manifestSummary(manifest: Inventory["manifest"]) {
  if (!manifest.present) {
    return {
      value: "—",
      label: "No manifest",
      tone: "text-amber-200",
    };
  }

  if (manifest.checked === 0) {
    return {
      value: "!",
      label: "Not verified",
      tone: "text-amber-200",
    };
  }

  return {
    value: String(manifest.mismatches.length),
    label: "Hash mismatches",
    tone: manifest.mismatches.length ? "text-rose-300" : "text-emerald-300",
  };
}

function mismatchReasonLabel(reason: string) {
  const labels: Record<string, string> = {
    hash_mismatch: "파일의 실제 지문이 manifest 기록과 다릅니다.",
    missing_file: "manifest에 적힌 파일이 ZIP 안에 없습니다.",
    invalid_sha256: "manifest의 SHA-256 값 형식이 올바르지 않습니다.",
    invalid_manifest: "manifest 내용을 검사 가능한 형식으로 읽지 못했습니다.",
    unsafe_manifest_path: "manifest에 안전하지 않은 파일 경로가 들어 있습니다.",
  };

  return labels[reason] ?? reason;
}

function friendlyError(error: unknown) {
  if (error instanceof Error) return error.message;
  return "검사를 마치지 못했습니다. 파일을 다시 확인해 주세요.";
}

export default function AuditWorkspace() {
  const rulesInputRef = useRef<HTMLInputElement>(null);
  const archiveInputRef = useRef<HTMLInputElement>(null);
  const [rulesFile, setRulesFile] = useState<File | null>(null);
  const [archiveFile, setArchiveFile] = useState<File | null>(null);
  const [submissionCopy, setSubmissionCopy] = useState("");
  const [demoMode, setDemoMode] = useState(false);
  const [isLoadingSample, setIsLoadingSample] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<AuditSuccess | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedCount = Number(Boolean(rulesFile)) + Number(Boolean(archiveFile));

  function selectRules(event: ChangeEvent<HTMLInputElement>) {
    setRulesFile(event.target.files?.[0] ?? null);
    setDemoMode(false);
    setResult(null);
    setError(null);
  }

  function selectArchive(event: ChangeEvent<HTMLInputElement>) {
    setArchiveFile(event.target.files?.[0] ?? null);
    setDemoMode(false);
    setResult(null);
    setError(null);
  }

  async function loadSample() {
    setIsLoadingSample(true);
    setError(null);
    setResult(null);

    try {
      const [rulesResponse, archiveResponse] = await Promise.all([
        fetch("/samples/challenge-rules.md"),
        fetch("/samples/CrossReady_Broken_Submission.zip"),
      ]);

      if (!rulesResponse.ok || !archiveResponse.ok) {
        throw new Error("샘플 파일을 불러오지 못했습니다.");
      }

      const [rulesBlob, archiveBlob] = await Promise.all([
        rulesResponse.blob(),
        archiveResponse.blob(),
      ]);

      setRulesFile(
        new File([rulesBlob], "challenge-rules.md", {
          type: "text/markdown",
        }),
      );
      setArchiveFile(
        new File([archiveBlob], "CrossReady_Broken_Submission.zip", {
          type: "application/zip",
        }),
      );
      setDemoMode(true);

      if (rulesInputRef.current) rulesInputRef.current.value = "";
      if (archiveInputRef.current) archiveInputRef.current.value = "";
    } catch (sampleError) {
      setError(friendlyError(sampleError));
    } finally {
      setIsLoadingSample(false);
    }
  }

  async function runAudit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!rulesFile || !archiveFile) {
      setError("규정 파일과 제출 ZIP을 모두 골라 주세요.");
      return;
    }

    setIsRunning(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append("rules", rulesFile);
    formData.append("archive", archiveFile);
    formData.append("demoMode", String(demoMode));

    try {
      const response = await fetch("/api/audit", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as AuditResponse;

      if (!response.ok || !payload.ok) {
        const message = payload.ok
          ? "검사 서버가 요청을 처리하지 못했습니다."
          : payload.error.message;
        throw new Error(message);
      }

      setResult(payload);
    } catch (auditError) {
      setError(friendlyError(auditError));
    } finally {
      setIsRunning(false);
    }
  }

  const badge = result ? modeLabel(result) : null;
  const manifestState = result
    ? manifestSummary(result.inventory.manifest)
    : null;

  return (
    <div className="space-y-5">
      <form
        onSubmit={runAudit}
        aria-busy={isRunning}
        className="overflow-hidden rounded-2xl border border-white/9 bg-panel/90 shadow-2xl shadow-black/15"
      >
        <div className="border-b border-white/8 px-5 py-5 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-sm font-medium text-white">
                Start an evidence audit
              </h2>
              <p className="mt-1 text-xs leading-5 text-zinc-400">
                규정 파일과 최종 제출 ZIP을 올려 실제 내용을 검사합니다.
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-white/5 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.14em] text-zinc-400">
              {selectedCount} / 2 added
            </span>
          </div>
        </div>

        <div className="space-y-3 p-4 sm:p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <input
                ref={rulesInputRef}
                id="rules-file"
                name="rules-file"
                type="file"
                accept=".pdf,.md,.txt,application/pdf,text/markdown,text/plain"
                className="peer sr-only"
                onChange={selectRules}
              />
              <label
                htmlFor="rules-file"
                className="group flex min-h-28 cursor-pointer flex-col justify-between rounded-xl border border-dashed border-white/12 bg-white/[0.018] p-4 transition-colors hover:border-accent/35 hover:bg-accent/[0.025] peer-focus-visible:border-accent/50 peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-accent/30"
              >
                <span className="flex items-start justify-between gap-3">
                  <span className="flex size-10 items-center justify-center rounded-lg border border-white/8 bg-white/4 text-zinc-400 transition-colors group-hover:text-accent">
                    <UploadIcon kind="rules" />
                  </span>
                  <span className="font-mono text-[9px] uppercase tracking-wider text-zinc-500">
                    PDF · MD · TXT
                  </span>
                </span>
                <span className="mt-4 block min-w-0">
                  <span className="block text-xs font-medium text-zinc-200">
                    Rules
                    <span className="ml-2 rounded bg-accent/8 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-wider text-accent/80">
                      Required
                    </span>
                  </span>
                  <span className="mt-1 block truncate text-[11px] text-zinc-400">
                    {rulesFile?.name ?? "규정 파일 고르기"}
                  </span>
                </span>
              </label>
            </div>

            <div>
              <input
                ref={archiveInputRef}
                id="archive-file"
                name="archive-file"
                type="file"
                accept=".zip,application/zip,application/x-zip-compressed"
                className="peer sr-only"
                onChange={selectArchive}
              />
              <label
                htmlFor="archive-file"
                className="group flex min-h-28 cursor-pointer flex-col justify-between rounded-xl border border-dashed border-white/12 bg-white/[0.018] p-4 transition-colors hover:border-accent/35 hover:bg-accent/[0.025] peer-focus-visible:border-accent/50 peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-accent/30"
              >
                <span className="flex items-start justify-between gap-3">
                  <span className="flex size-10 items-center justify-center rounded-lg border border-white/8 bg-white/4 text-zinc-400 transition-colors group-hover:text-accent">
                    <UploadIcon kind="archive" />
                  </span>
                  <span className="font-mono text-[9px] uppercase tracking-wider text-zinc-500">
                    ZIP
                  </span>
                </span>
                <span className="mt-4 block min-w-0">
                  <span className="block text-xs font-medium text-zinc-200">
                    Submission bundle
                    <span className="ml-2 rounded bg-accent/8 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-wider text-accent/80">
                      Required
                    </span>
                  </span>
                  <span className="mt-1 block truncate text-[11px] text-zinc-400">
                    {archiveFile?.name ?? "제출 ZIP 고르기"}
                  </span>
                </span>
              </label>
            </div>
          </div>

          <button
            type="button"
            onClick={loadSample}
            disabled={isLoadingSample || isRunning}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-sky-300/15 bg-sky-400/[0.045] px-4 py-3 text-[11px] font-medium text-sky-200 transition-colors hover:border-sky-300/30 hover:bg-sky-400/[0.075] disabled:cursor-wait disabled:opacity-60"
          >
            <UploadIcon kind="scan" />
            {isLoadingSample
              ? "샘플을 불러오는 중…"
              : "Load broken sample · 준비된 고장 사례로 체험"}
          </button>

          <div className="rounded-xl border border-white/7 bg-black/15 p-4">
            <label
              htmlFor="submission-copy"
              className="mb-2 block text-[11px] font-medium text-zinc-400"
            >
              Submission copy{" "}
              <span className="font-normal text-zinc-500">(optional)</span>
            </label>
            <textarea
              id="submission-copy"
              value={submissionCopy}
              onChange={(event) => setSubmissionCopy(event.target.value)}
              className="h-16 w-full resize-y rounded-lg border border-white/8 bg-black/20 px-3 py-2.5 text-[11px] leading-5 text-zinc-300 placeholder:text-zinc-500 focus-visible:border-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/20"
              placeholder="심사자가 읽을 설명을 붙여 넣을 수 있습니다…"
            />
            <p className="mt-2 text-[9px] leading-4 text-zinc-500">
              오늘 버전에서는 저장하지 않으며, 다음 연결 단계에서 비교에
              사용합니다.
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-xl border border-rose-300/20 bg-rose-400/[0.07] px-4 py-3 text-[11px] leading-5 text-rose-200"
            >
              {error}
            </div>
          )}
        </div>

        <div className="border-t border-white/8 bg-black/10 p-4 sm:p-5">
          <button
            type="submit"
            disabled={!rulesFile || !archiveFile || isRunning || isLoadingSample}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-accent text-sm font-semibold text-[#082116] shadow-[0_0_30px_rgba(98,215,154,0.08)] transition-colors hover:bg-[#b5ffd4] disabled:cursor-not-allowed disabled:opacity-45"
          >
            {isRunning ? "파일을 읽고 검사하는 중…" : "Run evidence audit"}
            {!isRunning && <UploadIcon kind="upload" />}
          </button>
          <p
            className="mt-3 text-center text-[10px] text-zinc-500"
            aria-live="polite"
          >
            {isRunning
              ? "ZIP 안의 파일을 안전하게 펼쳐 목록과 해시를 확인합니다."
              : demoMode
                ? "샘플 선택됨 · GPT를 실행하지 않는 체험 모드"
                : "API 키가 없으면 파일 검사는 계속되고 GPT 추출만 건너뜁니다."}
          </p>
        </div>
      </form>

      {result && badge && manifestState && (
        <section
          aria-labelledby="audit-result-heading"
          className="overflow-hidden rounded-2xl border border-white/9 bg-panel/90 shadow-2xl shadow-black/15"
        >
          <div className="border-b border-white/8 px-5 py-5 sm:px-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2
                  id="audit-result-heading"
                  className="text-sm font-medium text-white"
                >
                  방금 검사한 결과
                </h2>
                <p className="mt-1 max-w-md truncate text-[11px] text-zinc-400">
                  {result.inventory.archiveName}
                </p>
              </div>
              <span
                className={`rounded-full px-2.5 py-1 font-mono text-[8px] uppercase tracking-[0.12em] ring-1 ring-inset ${badge.className}`}
                title={badge.detail}
              >
                {badge.title}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 border-b border-white/8">
            <div className="border-r border-white/8 px-4 py-4">
              <p className="font-mono text-lg text-zinc-100">
                {result.inventory.totalFiles}
              </p>
              <p className="mt-1 text-[9px] uppercase tracking-wider text-zinc-500">
                Files read
              </p>
            </div>
            <div className="border-r border-white/8 px-4 py-4">
              <p className="font-mono text-lg text-zinc-100">
                {formatBytes(result.inventory.totalUncompressedBytes)}
              </p>
              <p className="mt-1 text-[9px] uppercase tracking-wider text-zinc-500">
                Unpacked
              </p>
            </div>
            <div className="px-4 py-4">
              <p className={`font-mono text-lg ${manifestState.tone}`}>
                {manifestState.value}
              </p>
              <p className="mt-1 text-[9px] uppercase tracking-wider text-zinc-500">
                {manifestState.label}
              </p>
            </div>
          </div>

          <div className="space-y-5 p-4 sm:p-5">
            {result.warnings.length > 0 && (
              <div className="rounded-xl border border-amber-200/15 bg-amber-200/[0.045] p-3">
                <p className="text-[10px] font-medium text-amber-100">
                  확인할 점
                </p>
                <ul className="mt-2 space-y-1 text-[10px] leading-4 text-amber-100/70">
                  {result.warnings.map((warning) => (
                    <li key={warning}>· {warning}</li>
                  ))}
                </ul>
              </div>
            )}

            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <h3 className="font-mono text-[9px] uppercase tracking-[0.15em] text-zinc-400">
                  Files inside the ZIP
                </h3>
                <span
                  className="font-mono text-[8px] text-zinc-600"
                  title={result.inventory.archiveSha256}
                >
                  ZIP {shortHash(result.inventory.archiveSha256)}
                </span>
              </div>
              <div className="max-h-64 overflow-y-auto rounded-xl border border-white/7 bg-black/15">
                <ul className="divide-y divide-white/6">
                  {result.inventory.entries.map((entry) => (
                    <li
                      key={entry.path}
                      className="flex items-center justify-between gap-3 px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[10px] text-zinc-300">
                          {entry.path}
                        </p>
                        <p className="mt-1 font-mono text-[8px] uppercase tracking-wider text-zinc-600">
                          {entry.kind} · {formatBytes(entry.size)}
                        </p>
                      </div>
                      <code
                        className="shrink-0 text-[8px] text-zinc-500"
                        title={entry.sha256}
                      >
                        {shortHash(entry.sha256)}
                      </code>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {result.inventory.manifest.mismatches.length > 0 && (
              <div>
                <h3 className="mb-2 font-mono text-[9px] uppercase tracking-[0.15em] text-rose-300">
                  Manifest mismatches
                </h3>
                <div className="space-y-2">
                  {result.inventory.manifest.mismatches.map((mismatch) => (
                    <article
                      key={`${mismatch.path}-${mismatch.reason}`}
                      className="rounded-xl border border-rose-300/12 bg-rose-400/[0.035] p-3"
                    >
                      <p className="break-all text-[10px] text-zinc-200">
                        {mismatch.path}
                      </p>
                      <p className="mt-1 text-[9px] leading-4 text-rose-200/70">
                        {mismatchReasonLabel(mismatch.reason)}
                      </p>
                    </article>
                  ))}
                </div>
              </div>
            )}

            <div>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="font-mono text-[9px] uppercase tracking-[0.15em] text-zinc-400">
                  Extracted requirements
                </h3>
                <span className="font-mono text-[9px] text-accent">
                  {result.requirements?.requirements.length ?? 0}
                </span>
              </div>

              {result.requirements ? (
                <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                  {result.requirements.requirements.map((requirement) => (
                    <article
                      key={requirement.id}
                      className="rounded-xl border border-white/7 bg-white/[0.018] p-3"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[8px] text-accent">
                          {requirement.id}
                        </span>
                        <span className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[7px] uppercase tracking-wider text-zinc-400">
                          {requirement.modality}
                        </span>
                        <span className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[7px] uppercase tracking-wider text-zinc-400">
                          {requirement.criticality}
                        </span>
                      </div>
                      <p className="mt-2 text-[10px] leading-5 text-zinc-300">
                        {requirement.statement}
                      </p>
                      <p className="mt-2 border-l border-accent/20 pl-2 text-[9px] leading-4 text-zinc-500">
                        {requirement.source.locator}:{" "}
                        {requirement.source.excerpt}
                      </p>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-white/10 px-4 py-5 text-center text-[10px] leading-5 text-zinc-500">
                  파일 목록 검사는 끝났습니다. 서버에 OpenAI API 키를 연결하면
                  규정 추출도 함께 표시됩니다.
                </div>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
