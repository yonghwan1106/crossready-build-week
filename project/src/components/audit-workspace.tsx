"use client";

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type MouseEvent,
} from "react";
import {
  FindingDetailDialog,
} from "@/components/finding-detail-dialog";
import type {
  AuditFinding,
  AuditResponse,
  AuditSuccess,
} from "@/lib/audit/types";
import { isAuditResponse } from "@/lib/audit/response-guard";

type UiError = {
  title: string;
  message: string;
  code?: string;
  action?: string;
  retryable: boolean;
  requestId?: string | null;
  resetAt?: string;
};

const CLIENT_AUDIT_TIMEOUT_MS = 125_000;

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

function modelMetadataSummary(result: AuditSuccess) {
  const runs = [
    result.metadata?.requirementExtraction,
    result.metadata?.crossAudit,
  ].filter((run) => run !== null && run !== undefined);
  const durationMs = runs.reduce((total, run) => total + run.durationMs, 0);
  const totalTokens = runs.reduce(
    (total, run) => total + (run.usage?.totalTokens ?? 0),
    0,
  );
  const models = Array.from(new Set(runs.map((run) => run.model)));

  return { durationMs, totalTokens, models };
}

function modeLabel(result: AuditSuccess) {
  const metadata = modelMetadataSummary(result);

  if (result.mode === "live") {
    return {
      title: "GPT-5.6 live",
      detail: metadata.models.join(", ") || result.model || "GPT-5.6",
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

  if (result.mode === "partial") {
    return {
      title: "Partial result",
      detail: metadata.models.join(", ") || "일부 AI 단계만 완료",
      className: "bg-amber-300/10 text-amber-200 ring-amber-200/25",
    };
  }

  return {
    title: "File scan only",
    detail: "GPT extraction skipped",
    className: "bg-amber-300/10 text-amber-200 ring-amber-200/25",
  };
}

function manifestSummary(manifest: AuditSuccess["inventory"]["manifest"]) {
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

function warningLabel(warning: string) {
  if (warning.includes("Sample mode used the bundled answer set")) {
    return "준비된 샘플 정답을 사용했습니다. GPT-5.6은 호출하지 않았습니다.";
  }
  if (warning.includes("OPENAI_API_KEY")) {
    return "OpenAI 연결이 없어 파일 검사만 완료했습니다.";
  }
  if (warning.includes("PDF requirement excerpts and page locators")) {
    return "PDF 규정의 문장·페이지 위치는 GPT가 찾았으므로 원문 페이지를 사람이 한 번 확인해야 합니다.";
  }
  return warning;
}

function failureMessage(
  error: Extract<AuditResponse, { ok: false }>["error"],
): UiError {
  const code = error.code.toUpperCase();
  const defaults: Record<string, Pick<UiError, "title" | "message" | "action">> =
    {
      RATE_LIMITED: {
        title: "요청이 잠시 몰렸습니다",
        message: "사용 가능 횟수가 다시 생긴 뒤 재시도해 주세요.",
        action: "잠시 기다렸다가 같은 파일로 다시 검사하세요.",
      },
      AUDIT_CAPACITY: {
        title: "지금 다른 검사를 처리하고 있습니다",
        message: "안전한 동시 처리 수를 넘지 않도록 새 검사를 잠시 기다립니다.",
        action: "잠시 후 같은 파일로 다시 검사하세요.",
      },
      TIMEOUT: {
        title: "검사 시간이 너무 길어졌습니다",
        message: "안전 제한 시간 안에 끝나지 않아 검사를 중단했습니다.",
        action: "ZIP 크기를 줄이거나 잠시 후 다시 시도하세요.",
      },
      ARCHIVE_TYPE: {
        title: "ZIP 파일이 필요합니다",
        message: "제출 묶음에는 .zip 파일만 사용할 수 있습니다.",
        action: "최종 제출 파일을 ZIP으로 묶어 다시 선택하세요.",
      },
      RULES_TYPE: {
        title: "규정 파일 형식을 확인해 주세요",
        message: "규정은 PDF, Markdown 또는 TXT 파일이어야 합니다.",
        action: "지원되는 형식으로 다시 선택하세요.",
      },
      ARCHIVE_TOO_LARGE: {
        title: "ZIP 파일이 너무 큽니다",
        message: "안전한 검사 범위를 넘어 파일을 열지 않았습니다.",
        action: "불필요한 파일을 빼고 ZIP을 작게 만든 뒤 다시 시도하세요.",
      },
      RULES_TOO_LARGE: {
        title: "규정 파일이 너무 큽니다",
        message: "안전한 검사 범위를 넘어 파일을 읽지 않았습니다.",
        action: "필요한 규정 페이지만 남겨 다시 시도하세요.",
      },
      RULES_PDF_TOO_MANY_PAGES: {
        title: "규정 PDF 페이지가 너무 많습니다",
        message: "한 번의 검사에서는 최대 40페이지까지 처리합니다.",
        action: "필요한 규정 페이지만 남긴 PDF로 다시 시도하세요.",
      },
      EMPTY_ARCHIVE: {
        title: "ZIP 안에 검사할 파일이 없습니다",
        message: "비어 있지 않은 최종 제출 ZIP을 선택해 주세요.",
        action: "ZIP 내용을 확인한 뒤 다시 선택하세요.",
      },
      API_KEY_MISSING: {
        title: "GPT 연결이 준비되지 않았습니다",
        message: "파일 검사는 가능하지만 요구사항 자동 추출은 할 수 없습니다.",
        action: "서버의 OpenAI 연결을 확인하거나 샘플 모드를 사용하세요.",
      },
      DAILY_BUDGET_EXHAUSTED: {
        title: "오늘 사용할 수 있는 검사 횟수를 모두 썼습니다",
        message: "새 한도가 시작될 때까지 실제 GPT 검사를 실행할 수 없습니다.",
        action: "표시된 재설정 시간 이후 다시 시도하세요.",
      },
      REQUEST_TOO_LARGE: {
        title: "한 번에 보낼 파일이 너무 큽니다",
        message: "규정과 제출 ZIP을 합친 크기가 안전한 검사 범위를 넘었습니다.",
        action: "불필요한 파일을 빼거나 용량을 줄인 뒤 다시 시도하세요.",
      },
      SUBMISSION_COPY_TOO_LARGE: {
        title: "제출 설명이 너무 깁니다",
        message: "붙여 넣은 설명이 한 번에 비교할 수 있는 길이를 넘었습니다.",
        action: "핵심 주장만 남겨 설명을 짧게 만든 뒤 다시 시도하세요.",
      },
    };
  const matched =
    defaults[code] ??
    (code.includes("RATE")
      ? defaults.RATE_LIMITED
      : code.includes("TIMEOUT")
        ? defaults.TIMEOUT
      : code.includes("SIZE") || code.includes("LARGE")
        ? defaults.ARCHIVE_TOO_LARGE
        : undefined);

  return {
    title: matched?.title ?? "검사를 마치지 못했습니다",
    message: matched?.message ?? error.message,
    action: matched?.action ?? error.action,
    retryable:
      error.retryable ??
      (code.includes("RATE") || code.includes("TIMEOUT")),
    code: error.code,
    requestId: error.requestId,
    resetAt: error.resetAt,
  };
}

function formatResetTime(resetAt: string) {
  const date = new Date(resetAt);
  if (Number.isNaN(date.getTime())) return resetAt;
  return date.toLocaleString("ko-KR", {
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function modelFailureMessage(
  failure: NonNullable<AuditSuccess["modelFailure"]>,
) {
  const messages: Record<
    NonNullable<AuditSuccess["modelFailure"]>["code"],
    { title: string; message: string; action: string }
  > = {
    auth: {
      title: "GPT 연결 인증을 확인해야 합니다",
      message: "서버의 OpenAI 인증 정보가 올바르지 않아 AI 검사를 멈췄습니다.",
      action: "관리자가 API 키를 확인한 뒤 다시 실행해야 합니다.",
    },
    quota: {
      title: "GPT 사용 한도가 부족합니다",
      message: "OpenAI 계정의 사용 한도가 부족해 AI 검사를 완료하지 못했습니다.",
      action: "계정 사용 한도를 확인한 뒤 다시 시도하세요.",
    },
    rate_limit: {
      title: "GPT 요청이 잠시 몰렸습니다",
      message: "짧은 시간에 요청이 많아 AI 검사 일부를 완료하지 못했습니다.",
      action: "잠시 기다렸다가 같은 파일로 다시 검사하세요.",
    },
    timeout: {
      title: "GPT 응답 시간이 초과되었습니다",
      message: "AI 단계가 제한 시간 안에 끝나지 않아 나머지 결과만 표시합니다.",
      action: "파일 크기를 줄이거나 잠시 후 다시 시도하세요.",
    },
    server: {
      title: "GPT 서버가 일시적으로 응답하지 않습니다",
      message: "OpenAI 서버 문제로 AI 검사 일부를 완료하지 못했습니다.",
      action: "잠시 후 같은 파일로 다시 검사하세요.",
    },
    refusal: {
      title: "GPT가 이 문서 처리를 완료하지 않았습니다",
      message: "AI 안전 판단으로 요청한 분석 결과를 만들지 못했습니다.",
      action: "민감한 내용을 제거하거나 사람이 직접 확인하세요.",
    },
    invalid_output: {
      title: "GPT 결과를 안전하게 읽지 못했습니다",
      message: "AI 응답이 필요한 형식과 달라 자동 판정에 사용하지 않았습니다.",
      action: "다시 검사하거나 표시된 파일을 사람이 확인하세요.",
    },
    request: {
      title: "GPT에 보낼 내용을 확인해야 합니다",
      message: "AI 요청 형식이나 내용 문제로 검사를 시작하지 못했습니다.",
      action: "파일 형식과 내용을 확인한 뒤 다시 시도하세요.",
    },
    unknown: {
      title: "GPT 검사를 완료하지 못했습니다",
      message: "알 수 없는 문제로 AI 검사 일부를 완료하지 못했습니다.",
      action: "잠시 후 다시 시도하고, 계속되면 요청 ID를 확인하세요.",
    },
  };

  return messages[failure.code];
}

function findingStatus(status: string) {
  const styles: Record<string, { label: string; className: string }> = {
    PROVEN: {
      label: "확인됨",
      className: "bg-emerald-400/10 text-emerald-300 ring-emerald-300/20",
    },
    CONTRADICTED: {
      label: "서로 모순",
      className: "bg-rose-400/10 text-rose-300 ring-rose-300/20",
    },
    MISSING: {
      label: "근거 없음",
      className: "bg-amber-300/10 text-amber-200 ring-amber-200/20",
    },
    NEEDS_HUMAN: {
      label: "사람 확인 필요",
      className: "bg-sky-400/10 text-sky-300 ring-sky-300/20",
    },
  };

  return (
    styles[status] ?? {
      label: status,
      className: "bg-white/5 text-zinc-300 ring-white/10",
    }
  );
}

export default function AuditWorkspace() {
  const rulesInputRef = useRef<HTMLInputElement>(null);
  const archiveInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const resultHeadingRef = useRef<HTMLHeadingElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const userCancelledRef = useRef(false);
  const timedOutRef = useRef(false);
  const findingTriggerRef = useRef<HTMLButtonElement | null>(null);
  const [rulesFile, setRulesFile] = useState<File | null>(null);
  const [archiveFile, setArchiveFile] = useState<File | null>(null);
  const [submissionCopy, setSubmissionCopy] = useState("");
  const [demoMode, setDemoMode] = useState(false);
  const [isLoadingSample, setIsLoadingSample] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<AuditSuccess | null>(null);
  const [error, setError] = useState<UiError | null>(null);
  const [selectedFinding, setSelectedFinding] =
    useState<AuditFinding | null>(null);

  const selectedCount = Number(Boolean(rulesFile)) + Number(Boolean(archiveFile));

  useEffect(() => {
    if (result) resultHeadingRef.current?.focus();
  }, [result]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

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
      setError({
        title: "샘플을 불러오지 못했습니다",
        message:
          sampleError instanceof Error
            ? sampleError.message
            : "네트워크 연결을 확인해 주세요.",
        retryable: true,
      });
    } finally {
      setIsLoadingSample(false);
    }
  }

  async function runAudit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!rulesFile || !archiveFile) {
      setError({
        title: "파일 두 개가 필요합니다",
        message: "규정 파일과 제출 ZIP을 모두 골라 주세요.",
        retryable: false,
      });
      return;
    }

    const controller = new AbortController();
    if (!sessionIdRef.current) {
      sessionIdRef.current = crypto.randomUUID();
    }
    abortControllerRef.current = controller;
    userCancelledRef.current = false;
    timedOutRef.current = false;
    setIsRunning(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append("rules", rulesFile);
    formData.append("archive", archiveFile);
    formData.append("demoMode", String(demoMode));
    formData.append("submissionCopy", submissionCopy);

    timeoutRef.current = setTimeout(() => {
      timedOutRef.current = true;
      controller.abort();
    }, CLIENT_AUDIT_TIMEOUT_MS);

    try {
      const response = await fetch("/api/audit", {
        method: "POST",
        body: formData,
        signal: controller.signal,
        headers: {
          "x-crossready-session": sessionIdRef.current,
        },
      });
      const contentType = response.headers.get("content-type") ?? "";
      let payload: AuditResponse | null = null;
      if (contentType.toLowerCase().includes("application/json")) {
        try {
          const candidate: unknown = await response.json();
          payload = isAuditResponse(candidate) ? candidate : null;
        } catch {
          payload = null;
        }
      }

      if (!payload) {
        setError({
          title: "검사 서버가 응답하지 않았습니다",
          message: "잠시 후 같은 파일로 다시 시도해 주세요.",
          action: "연결을 확인한 뒤 다시 시도하세요.",
          retryable: true,
        });
        return;
      }

      if (!response.ok || !payload.ok) {
        setError(
          payload.ok
            ? {
                title: "검사 서버가 응답하지 않았습니다",
                message: "잠시 후 같은 파일로 다시 시도해 주세요.",
                retryable: true,
              }
            : failureMessage(payload.error),
        );
        return;
      }

      setResult(payload);
    } catch (auditError) {
      if (auditError instanceof Error && auditError.name === "AbortError") {
        setError(
          timedOutRef.current
            ? {
                title: "검사 시간이 너무 길어졌습니다",
                message: "125초 안에 끝나지 않아 안전하게 중단했습니다.",
                action: "ZIP 크기를 줄이거나 잠시 후 다시 시도하세요.",
                retryable: true,
                code: "CLIENT_TIMEOUT",
              }
            : {
                title: "검사를 취소했습니다",
                message: userCancelledRef.current
                  ? "파일은 변경되지 않았습니다. 준비되면 다시 실행할 수 있습니다."
                  : "연결이 중단되어 검사를 끝내지 못했습니다.",
                retryable: true,
                code: "CANCELLED",
              },
        );
      } else {
        setError({
          title: "검사 서버에 연결하지 못했습니다",
          message:
            auditError instanceof Error
              ? auditError.message
              : "네트워크 연결을 확인해 주세요.",
          action: "연결을 확인한 뒤 다시 시도하세요.",
          retryable: true,
        });
      }
    } finally {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
      abortControllerRef.current = null;
      setIsRunning(false);
    }
  }

  function cancelAudit() {
    userCancelledRef.current = true;
    abortControllerRef.current?.abort();
  }

  function retryAudit() {
    setError(null);
    formRef.current?.requestSubmit();
  }

  function openFinding(
    finding: AuditFinding,
    event: MouseEvent<HTMLButtonElement>,
  ) {
    findingTriggerRef.current = event.currentTarget;
    setSelectedFinding(finding);
  }

  function closeFinding() {
    setSelectedFinding(null);
    requestAnimationFrame(() => findingTriggerRef.current?.focus());
  }

  const badge = result ? modeLabel(result) : null;
  const manifestState = result
    ? manifestSummary(result.inventory.manifest)
    : null;
  const modelMetadata = result ? modelMetadataSummary(result) : null;
  const modelFailureCopy = result?.modelFailure
    ? modelFailureMessage(result.modelFailure)
    : null;

  return (
    <div className="space-y-5">
      <form
        ref={formRef}
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
                disabled={isRunning || isLoadingSample}
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
                disabled={isRunning || isLoadingSample}
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
              disabled={isRunning}
              className="h-16 w-full resize-y rounded-lg border border-white/8 bg-black/20 px-3 py-2.5 text-[11px] leading-5 text-zinc-300 placeholder:text-zinc-500 focus-visible:border-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/20"
              placeholder="심사자가 읽을 설명을 붙여 넣을 수 있습니다…"
            />
            <p className="mt-2 text-[9px] leading-4 text-zinc-500">
              실제 GPT 검사에서는 규정 원문·이 설명·ZIP 안의 제한된 텍스트
              미리보기가 OpenAI로 전송됩니다. 별도로 저장하지 않으며 ZIP의
              바이너리 파일은 보내지 않습니다.
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-xl border border-rose-300/20 bg-rose-400/[0.07] p-4 text-[11px] leading-5 text-rose-100"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-rose-100">{error.title}</p>
                  <p className="mt-1 text-rose-100/75">{error.message}</p>
                  {error.action && (
                    <p className="mt-2 text-rose-100/60">
                      다음 단계: {error.action}
                    </p>
                  )}
                  {error.resetAt && (
                    <p className="mt-2 font-medium text-rose-100/80">
                      {formatResetTime(error.resetAt)} 이후 다시 가능
                    </p>
                  )}
                </div>
                {error.retryable && (
                  <button
                    type="button"
                    onClick={retryAudit}
                    disabled={isRunning}
                    className="shrink-0 rounded-lg border border-rose-200/20 bg-rose-100/5 px-3 py-2 text-[10px] font-medium text-rose-100 transition-colors hover:bg-rose-100/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-200/40"
                  >
                    다시 검사
                  </button>
                )}
              </div>
              {(error.code || error.requestId) && (
                <p className="mt-3 break-all font-mono text-[8px] uppercase tracking-wider text-rose-100/40">
                  {error.code && `code ${error.code}`}
                  {error.code && error.requestId && " · "}
                  {error.requestId && `request ${error.requestId}`}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="border-t border-white/8 bg-black/10 p-4 sm:p-5">
          <div className={isRunning ? "grid grid-cols-[1fr_auto] gap-2" : ""}>
            <button
              type="submit"
              disabled={
                !rulesFile || !archiveFile || isRunning || isLoadingSample
              }
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-accent text-sm font-semibold text-[#082116] shadow-[0_0_30px_rgba(98,215,154,0.08)] transition-colors hover:bg-[#b5ffd4] disabled:cursor-not-allowed disabled:opacity-45"
            >
              {isRunning ? "파일을 읽고 검사하는 중…" : "Run evidence audit"}
              {!isRunning && <UploadIcon kind="upload" />}
            </button>
            {isRunning && (
              <button
                type="button"
                onClick={cancelAudit}
                className="h-11 rounded-xl border border-white/12 bg-white/5 px-4 text-xs font-medium text-zinc-200 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
              >
                취소
              </button>
            )}
          </div>
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

      <p className="sr-only" role="status" aria-live="polite">
        {result
          ? `검사가 완료되었습니다. ${result.inventory.totalFiles}개 파일을 읽었습니다.`
          : ""}
      </p>

      {result && badge && manifestState && (
        <section
          data-audit-result
          aria-labelledby="audit-result-heading"
          className="overflow-hidden rounded-2xl border border-white/9 bg-panel/90 shadow-2xl shadow-black/15"
        >
          <div className="border-b border-white/8 px-5 py-5 sm:px-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2
                  ref={resultHeadingRef}
                  id="audit-result-heading"
                  tabIndex={-1}
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
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[8px] uppercase tracking-wider text-zinc-500">
              {modelMetadata && modelMetadata.durationMs > 0 && (
                <span>{(modelMetadata.durationMs / 1000).toFixed(1)}s</span>
              )}
              {modelMetadata && modelMetadata.models.length > 0 && (
                <span>{modelMetadata.models.join(" + ")}</span>
              )}
              {modelMetadata && modelMetadata.totalTokens > 0 && (
                <span>
                  이번 검사 {modelMetadata.totalTokens.toLocaleString("ko-KR")} 토큰
                </span>
              )}
              {result.limits && (
                <span
                  className={
                    result.limits.remaining === 0
                      ? "text-amber-200"
                      : "text-zinc-500"
                  }
                >
                  남은 검사 {result.limits.remaining}/{result.limits.limit}
                  {result.limits.remaining === 0 &&
                    ` · ${formatResetTime(result.limits.resetAt)} 재설정`}
                </span>
              )}
            </div>
          </div>

          {result.modelFailure && modelFailureCopy && (
            <div
              role="status"
              className="border-b border-amber-200/15 bg-amber-200/[0.045] px-5 py-4 sm:px-6"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-amber-100">
                    {modelFailureCopy.title}
                  </p>
                  <p className="mt-1 text-[10px] leading-5 text-amber-100/70">
                    {modelFailureCopy.message}
                  </p>
                  <p className="mt-2 text-[10px] leading-5 text-amber-100/60">
                    다음 단계: {modelFailureCopy.action}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full border border-amber-200/15 bg-amber-100/5 px-2.5 py-1 font-mono text-[8px] uppercase tracking-wider text-amber-100/70">
                    {result.modelFailure.retryable
                      ? "retry available"
                      : "manual check"}
                  </span>
                  {result.modelFailure.retryable && (
                    <button
                      type="button"
                      onClick={retryAudit}
                      className="rounded-lg border border-amber-200/20 bg-amber-100/5 px-3 py-1.5 text-[9px] font-medium text-amber-100 transition-colors hover:bg-amber-100/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/40"
                    >
                      다시 검사
                    </button>
                  )}
                </div>
              </div>
              <p className="mt-3 break-all font-mono text-[8px] uppercase tracking-wider text-amber-100/40">
                code {result.modelFailure.code}
                {result.modelFailure.requestId &&
                  ` · request ${result.modelFailure.requestId}`}
              </p>
            </div>
          )}

          {result.report && (
            <>
              <div className="grid grid-cols-2 border-b border-white/8 sm:grid-cols-4">
                {[
                  {
                    label: "확인됨",
                    value: result.report.summary.proven,
                    tone: "text-emerald-300",
                  },
                  {
                    label: "서로 모순",
                    value: result.report.summary.contradicted,
                    tone: "text-rose-300",
                  },
                  {
                    label: "근거 없음",
                    value: result.report.summary.missing,
                    tone: "text-amber-200",
                  },
                  {
                    label: "사람 확인",
                    value: result.report.summary.needsHuman,
                    tone: "text-sky-300",
                  },
                ].map((item, index) => (
                  <div
                    key={item.label}
                    className={`border-white/8 px-4 py-4 ${
                      index % 2 === 0 ? "border-r" : ""
                    } ${index < 2 ? "border-b sm:border-b-0" : ""} ${
                      index === 1 ? "sm:border-r" : ""
                    }`}
                  >
                    <p className={`font-mono text-xl ${item.tone}`}>
                      {item.value}
                    </p>
                    <p className="mt-1 text-[9px] uppercase tracking-wider text-zinc-500">
                      {item.label}
                    </p>
                  </div>
                ))}
              </div>

              <div className="border-b border-white/8 p-4 sm:p-5">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-xs font-medium text-white">
                      {result.mode === "sample"
                        ? "샘플 정답 기반 판정"
                        : result.mode === "partial"
                          ? "부분 완료 판정"
                          : "실제 감사 판정"}
                    </h3>
                    <p className="mt-1 text-[9px] text-zinc-500">
                      판정을 누르면 파일 위치와 원문 근거를 볼 수 있습니다.
                    </p>
                  </div>
                  <span className="font-mono text-[9px] text-zinc-500">
                    {result.report.findings.length} findings
                  </span>
                </div>

                {result.report.findings.length > 0 ? (
                  <div className="space-y-2">
                    {result.report.findings.map((finding) => {
                      const status = findingStatus(finding.status);
                      return (
                        <button
                          key={finding.id}
                          type="button"
                          onClick={(event) => openFinding(finding, event)}
                          className="group w-full rounded-xl border border-white/8 bg-white/[0.018] p-4 text-left transition-colors hover:border-white/14 hover:bg-white/[0.035] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  className={`rounded-full px-2 py-1 font-mono text-[8px] uppercase tracking-[0.12em] ring-1 ring-inset ${status.className}`}
                                >
                                  {status.label}
                                </span>
                                <span className="font-mono text-[8px] uppercase tracking-wider text-zinc-500">
                                  {finding.severity}
                                </span>
                              </div>
                              <p className="mt-2 text-xs font-medium leading-5 text-zinc-200">
                                {finding.title}
                              </p>
                              <p className="mt-1 line-clamp-2 text-[10px] leading-5 text-zinc-500">
                                {finding.explanation}
                              </p>
                            </div>
                            <span
                              aria-hidden="true"
                              className="mt-1 shrink-0 text-zinc-600 transition-transform group-hover:translate-x-0.5 group-hover:text-accent"
                            >
                              →
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="rounded-xl border border-dashed border-white/10 p-4 text-[11px] text-zinc-500">
                    표시할 판정이 없습니다.
                  </p>
                )}
              </div>
            </>
          )}

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
                    <li key={warning}>· {warningLabel(warning)}</li>
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
                  {result.mode === "sample"
                    ? "Bundled sample requirements"
                    : "Extracted requirements"}
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
      {selectedFinding && (
        <FindingDetailDialog
          finding={selectedFinding}
          onClose={closeFinding}
        />
      )}
    </div>
  );
}
