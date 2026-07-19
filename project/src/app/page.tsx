import type { ReactNode } from "react";
import AuditWorkspace from "@/components/audit-workspace";

type IconName =
  | "archive"
  | "arrow"
  | "check"
  | "chevron"
  | "file"
  | "globe"
  | "layers"
  | "link"
  | "plus"
  | "scan"
  | "shield"
  | "spark"
  | "upload"
  | "warning";

function Icon({
  name,
  className = "size-4",
}: {
  name: IconName;
  className?: string;
}) {
  const paths: Record<IconName, ReactNode> = {
    archive: (
      <>
        <path d="M4 7h16" />
        <path d="M5 7v12h14V7" />
        <path d="M3 3h18v4H3z" />
        <path d="M9 11h6" />
      </>
    ),
    arrow: (
      <>
        <path d="M5 12h14" />
        <path d="m13 6 6 6-6 6" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    chevron: <path d="m9 18 6-6-6-6" />,
    file: (
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6" />
        <path d="M8 13h8M8 17h5" />
      </>
    ),
    globe: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" />
      </>
    ),
    layers: (
      <>
        <path d="m12 2 9 5-9 5-9-5z" />
        <path d="m3 12 9 5 9-5M3 17l9 5 9-5" />
      </>
    ),
    link: (
      <>
        <path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1.1 1.1" />
        <path d="M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1.1-1.1" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    scan: (
      <>
        <path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3" />
        <path d="M7 12h10M12 7v10" />
      </>
    ),
    shield: (
      <>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
        <path d="m9 12 2 2 4-5" />
      </>
    ),
    spark: (
      <path d="m12 3-1.2 4.2a5 5 0 0 1-3.5 3.5L3 12l4.3 1.2a5 5 0 0 1 3.5 3.5L12 21l1.2-4.3a5 5 0 0 1 3.5-3.5L21 12l-4.3-1.3a5 5 0 0 1-3.5-3.5z" />
    ),
    upload: (
      <>
        <path d="M12 16V4" />
        <path d="m7 9 5-5 5 5M4 20h16" />
      </>
    ),
    warning: (
      <>
        <path d="M10.3 3.7 2.4 18a2 2 0 0 0 1.8 3h15.6a2 2 0 0 0 1.8-3L13.7 3.7a2 2 0 0 0-3.4 0" />
        <path d="M12 9v4M12 17h.01" />
      </>
    ),
  };

  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}

const signals = [
  {
    value: "1",
    label: "Proven",
    tone: "text-emerald-300",
    border: "border-emerald-300/20",
  },
  {
    value: "8",
    label: "Contradicted",
    tone: "text-rose-300",
    border: "border-rose-300/20",
  },
  {
    value: "1",
    label: "Missing",
    tone: "text-amber-200",
    border: "border-amber-200/20",
  },
  {
    value: "2",
    label: "Needs review",
    tone: "text-sky-300",
    border: "border-sky-300/20",
  },
];

const findings = [
  {
    status: "Contradicted",
    statusStyle: "bg-rose-400/10 text-rose-300 ring-rose-300/20",
    icon: "warning" as const,
    iconStyle: "bg-rose-400/10 text-rose-300",
    title: "Submitted model contradicts runtime evidence",
    detail:
      "The submission claims GPT-5.6, while both configuration and the API trace show gpt-4.1-mini.",
    evidence:
      "submission/description.md ↔ repository/src/config.ts ↔ repository/logs/api-trace.json",
  },
  {
    status: "Contradicted",
    statusStyle: "bg-rose-400/10 text-rose-300 ring-rose-300/20",
    icon: "warning" as const,
    iconStyle: "bg-rose-400/10 text-rose-300",
    title: "FINAL v3 filename contains a v2.1 report",
    detail:
      "The manifest presents a FINAL_v3 PDF, but the rendered document identifies itself as version 2.1.",
    evidence: "manifest.json ↔ docs/technical-overview_FINAL_v3.pdf · p.1",
  },
  {
    status: "Contradicted",
    statusStyle: "bg-rose-400/10 text-rose-300 ring-rose-300/20",
    icon: "warning" as const,
    iconStyle: "bg-rose-400/10 text-rose-300",
    title: "Passing-test claim conflicts with machine results",
    detail:
      "The submission says all 43 tests pass; the machine report records 38 passed, 2 failed, and 3 skipped.",
    evidence: "submission/description.md ↔ repository/test-results.json",
  },
];

const workflow = [
  {
    number: "01",
    title: "Extract requirements",
    detail: "Turn long rules into atomic, testable claims.",
  },
  {
    number: "02",
    title: "Cross-check artifacts",
    detail: "Compare package files, code snapshots, and submission copy.",
  },
  {
    number: "03",
    title: "Review exact evidence",
    detail: "See where every claim was proven—or where it broke.",
  },
];

export default function Home() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div
        aria-hidden="true"
        className="dot-grid pointer-events-none absolute inset-x-0 top-0 h-[34rem] opacity-50"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-0 h-[34rem] w-[58rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(98,215,154,0.08),transparent_64%)] blur-2xl"
      />

      <header className="relative z-10 border-b border-white/7">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-5 sm:px-8 lg:px-10">
          <div className="flex items-center gap-3">
            <div className="flex size-8 items-center justify-center rounded-lg border border-accent/30 bg-accent/10 text-accent">
              <Icon name="scan" className="size-[18px]" />
            </div>
            <span className="text-[15px] font-semibold tracking-[-0.02em]">
              CrossReady
            </span>
            <span className="hidden rounded-full border border-white/10 bg-white/4 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.16em] text-zinc-400 sm:inline-flex">
              Prototype
            </span>
          </div>

          <nav
            aria-label="Primary navigation"
            className="hidden items-center gap-1 text-sm text-zinc-400 md:flex"
          >
            <a
              href="#workspace"
              className="rounded-md bg-white/6 px-3 py-2 font-medium text-zinc-100"
            >
              Workspace
            </a>
            <a
              href="#evidence"
              className="rounded-md px-3 py-2 transition-colors hover:text-zinc-100"
            >
              Evidence
            </a>
            <a
              href="#workflow"
              className="rounded-md px-3 py-2 transition-colors hover:text-zinc-100"
            >
              How it works
            </a>
          </nav>

          <a
            href="#workspace"
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-accent/20 bg-accent/8 px-3 text-xs font-medium text-accent transition-colors hover:border-accent/35 hover:bg-accent/12 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          >
            <Icon name="plus" />
            Start audit
          </a>
        </div>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-[1440px] px-5 py-12 sm:px-8 sm:py-16 lg:px-10">
        <section className="mb-10 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div className="max-w-3xl">
            <div className="mb-5 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-accent">
              <span className="h-px w-6 bg-accent/70" />
              Submission evidence intelligence
            </div>
            <h1 className="max-w-2xl text-4xl font-medium leading-[1.05] tracking-[-0.05em] text-white sm:text-5xl lg:text-[3.7rem]">
              Every artifact agrees
              <span className="block text-zinc-500">before you submit.</span>
            </h1>
            <p className="mt-5 max-w-2xl text-[15px] leading-7 text-zinc-400 sm:text-base">
              CrossReady compares requirements, deliverables, code snapshots,
              packaged documents, and submission copy—then shows exactly where
              each claim was proven, contradicted, or left unverified.
            </p>
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-white/8 bg-panel/80 px-4 py-3 backdrop-blur">
            <div className="flex size-9 items-center justify-center rounded-lg bg-accent/10 text-accent">
              <Icon name="shield" />
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-200">
                Human stays in control
              </p>
              <p className="mt-0.5 text-[11px] text-zinc-400">
                Evidence only · No silent rewrites
              </p>
            </div>
          </div>
        </section>

        <section
          id="workspace"
          className="grid items-start gap-5 xl:grid-cols-[minmax(0,0.83fr)_minmax(0,1.17fr)]"
        >
          <AuditWorkspace />
          <div
            id="evidence"
            aria-label="Illustrative report preview"
            className="overflow-hidden rounded-2xl border border-dashed border-white/9 bg-panel/75 shadow-2xl shadow-black/15"
          >
            <div className="flex flex-col gap-4 border-b border-white/8 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-lg border border-accent/20 bg-accent/8 text-accent">
                  <Icon name="layers" className="size-[17px]" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-medium text-white">
                      Illustrative report preview
                    </h2>
                    <span className="size-1.5 rounded-full bg-amber-300 shadow-[0_0_8px_rgba(252,211,77,0.6)]" />
                  </div>
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.1em] text-zinc-400">
                    Static sample · run an audit to generate results
                  </p>
                </div>
              </div>
              <span
                className="inline-flex h-8 items-center justify-center rounded-lg border border-white/9 bg-white/4 px-3 text-[11px] font-medium text-zinc-400"
              >
                Example only
              </span>
            </div>

            <div className="grid grid-cols-2 border-b border-white/8 sm:grid-cols-4">
              {signals.map((signal, index) => (
                <div
                  key={signal.label}
                  className={`border-white/8 px-5 py-4 ${
                    index % 2 === 0 ? "border-r" : ""
                  } ${index < 2 ? "border-b sm:border-b-0" : ""} ${
                    index === 1 ? "sm:border-r" : ""
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`font-mono text-xl ${signal.tone}`}>
                      {signal.value}
                    </span>
                    <span
                      className={`size-1.5 rounded-full border ${signal.border} ${signal.tone} bg-current opacity-80`}
                    />
                  </div>
                  <p className="mt-1 text-[10px] uppercase tracking-[0.08em] text-zinc-400">
                    {signal.label}
                  </p>
                </div>
              ))}
            </div>

            <div className="p-4 sm:p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-mono text-[9px] uppercase tracking-[0.16em] text-zinc-400">
                  Highest-impact findings
                </h2>
                <span className="text-[11px] text-zinc-400">Sorted by risk</span>
              </div>

              <div className="space-y-2.5">
                {findings.map((finding) => (
                  <article
                    key={finding.title}
                    className="rounded-xl border border-white/8 bg-white/[0.018] p-4 transition-colors hover:bg-white/[0.03]"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg ${finding.iconStyle}`}
                      >
                        <Icon name={finding.icon} className="size-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full px-2 py-1 font-mono text-[8px] uppercase tracking-[0.12em] ring-1 ring-inset ${finding.statusStyle}`}
                          >
                            {finding.status}
                          </span>
                          <h3 className="text-xs font-medium text-zinc-200">
                            {finding.title}
                          </h3>
                        </div>
                        <p className="mt-2 text-[11px] leading-5 text-zinc-400">
                          {finding.detail}
                        </p>
                        <div className="mt-3 flex items-center gap-2 rounded-md bg-black/20 px-2.5 py-2 font-mono text-[10px] text-zinc-400">
                          <Icon name="link" className="size-3 shrink-0" />
                          <span className="truncate">{finding.evidence}</span>
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section
          id="workflow"
          className="mt-5 rounded-2xl border border-white/8 bg-panel/55 px-5 py-6 sm:px-6 lg:py-7"
        >
          <div className="grid gap-6 lg:grid-cols-[0.7fr_1.3fr] lg:items-center">
            <div>
              <div className="mb-3 flex items-center gap-2 text-accent">
                <Icon name="spark" className="size-4" />
                <h2 className="font-mono text-[9px] uppercase tracking-[0.16em]">
                  How CrossReady works
                </h2>
              </div>
              <p className="max-w-sm text-lg font-medium tracking-[-0.025em] text-zinc-200">
                From scattered claims to one reviewable evidence map.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {workflow.map((step) => (
                <div
                  key={step.number}
                  className="rounded-xl border border-white/7 bg-black/10 p-4"
                >
                  <span className="font-mono text-[9px] text-accent/60">
                    {step.number}
                  </span>
                  <p className="mt-3 text-xs font-medium text-zinc-200">
                    {step.title}
                  </p>
                  <p className="mt-1.5 text-[11px] leading-5 text-zinc-400">
                    {step.detail}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="relative z-10 mx-auto flex w-full max-w-[1440px] flex-col justify-between gap-3 border-t border-white/7 px-5 py-6 text-[10px] text-zinc-500 sm:flex-row sm:px-8 lg:px-10">
        <p>CrossReady · Evidence before submission</p>
        <p className="font-mono uppercase tracking-[0.1em]">
          OpenAI Build Week 2026
        </p>
      </footer>
    </div>
  );
}
