import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  acquireAuditRequestSlot,
  consumeLiveAuditBudget,
  deriveAuditIdentity,
  resetLiveAuditBudgetForTests,
} from "./cost-guard";

const CLIENT_LIMIT_ENV = "CROSSREADY_LIVE_AUDIT_CLIENT_LIMIT";
const DAILY_LIMIT_ENV = "CROSSREADY_LIVE_AUDIT_DAILY_LIMIT";
const ACTIVE_LIMIT_ENV = "CROSSREADY_ACTIVE_AUDIT_LIMIT";

const originalClientLimit = process.env[CLIENT_LIMIT_ENV];
const originalDailyLimit = process.env[DAILY_LIMIT_ENV];
const originalActiveLimit = process.env[ACTIVE_LIMIT_ENV];

function requestWith(headers: Record<string, string>): Request {
  return new Request("https://crossready.test/api/audit", { headers });
}

function restoreEnvironment(): void {
  if (originalClientLimit === undefined) {
    delete process.env[CLIENT_LIMIT_ENV];
  } else {
    process.env[CLIENT_LIMIT_ENV] = originalClientLimit;
  }

  if (originalDailyLimit === undefined) {
    delete process.env[DAILY_LIMIT_ENV];
  } else {
    process.env[DAILY_LIMIT_ENV] = originalDailyLimit;
  }

  if (originalActiveLimit === undefined) {
    delete process.env[ACTIVE_LIMIT_ENV];
  } else {
    process.env[ACTIVE_LIMIT_ENV] = originalActiveLimit;
  }
}

beforeEach(() => {
  delete process.env[CLIENT_LIMIT_ENV];
  delete process.env[DAILY_LIMIT_ENV];
  delete process.env[ACTIVE_LIMIT_ENV];
  resetLiveAuditBudgetForTests();
});

afterEach(() => {
  restoreEnvironment();
  resetLiveAuditBudgetForTests();
});

describe("acquireAuditRequestSlot", () => {
  it("allows two active requests by default and releases slots idempotently", () => {
    const first = acquireAuditRequestSlot();
    const second = acquireAuditRequestSlot();
    const blocked = acquireAuditRequestSlot();

    expect(first).toMatchObject({ allowed: true, active: 1, limit: 2 });
    expect(second).toMatchObject({ allowed: true, active: 2, limit: 2 });
    expect(blocked).toMatchObject({ allowed: false, active: 2, limit: 2 });

    first.release();
    first.release();
    const replacement = acquireAuditRequestSlot();
    expect(replacement).toMatchObject({
      allowed: true,
      active: 2,
      limit: 2,
    });

    second.release();
    replacement.release();
  });

  it("clamps the configured active-request ceiling from one to ten", () => {
    process.env[ACTIVE_LIMIT_ENV] = "0";
    const only = acquireAuditRequestSlot();
    expect(only).toMatchObject({ allowed: true, limit: 1 });
    expect(acquireAuditRequestSlot()).toMatchObject({
      allowed: false,
      limit: 1,
    });
    only.release();

    resetLiveAuditBudgetForTests();
    process.env[ACTIVE_LIMIT_ENV] = "999";
    const leases = Array.from(
      { length: 10 },
      () => acquireAuditRequestSlot(),
    );
    expect(leases.every((lease) => lease.allowed)).toBe(true);
    expect(acquireAuditRequestSlot()).toMatchObject({
      allowed: false,
      limit: 10,
    });
    leases.forEach((lease) => lease.release());
  });
});

describe("deriveAuditIdentity", () => {
  it("prioritizes Vercel IP and does not let a changed session create a new bucket", () => {
    const first = deriveAuditIdentity(
      requestWith({
        "x-vercel-forwarded-for": "203.0.113.8",
        "x-real-ip": "198.51.100.7",
        "x-forwarded-for": "192.0.2.4, 192.0.2.5",
        "x-crossready-session": "session-one",
      }),
    );
    const second = deriveAuditIdentity(
      requestWith({
        "x-vercel-forwarded-for": "203.0.113.8",
        "x-real-ip": "198.51.100.99",
        "x-forwarded-for": "192.0.2.99",
        "x-crossready-session": "session-two",
      }),
    );

    expect(first).toEqual(second);
    expect(first.fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(first.fingerprint).not.toContain("203.0.113.8");
    expect(first.fingerprint).not.toContain("session-one");
  });

  it("falls back through real IP, first forwarded IP, then bounded session", () => {
    const realIp = deriveAuditIdentity(
      requestWith({
        "x-real-ip": "198.51.100.7",
        "x-forwarded-for": "192.0.2.4, 192.0.2.5",
        "x-crossready-session": "same-session",
      }),
    );
    const forwardedIp = deriveAuditIdentity(
      requestWith({
        "x-forwarded-for": "192.0.2.4, 192.0.2.5",
        "x-crossready-session": "same-session",
      }),
    );
    const session = deriveAuditIdentity(
      requestWith({ "x-crossready-session": "same-session" }),
    );

    expect(realIp).not.toEqual(forwardedIp);
    expect(forwardedIp).not.toEqual(session);
    expect(
      deriveAuditIdentity(
        requestWith({ "x-forwarded-for": "192.0.2.4, 203.0.113.10" }),
      ),
    ).toEqual(
      deriveAuditIdentity(
        requestWith({ "x-forwarded-for": "192.0.2.4, 198.51.100.20" }),
      ),
    );
  });

  it("ignores oversized untrusted headers instead of hashing attacker-sized input", () => {
    const oversizedIp = "1".repeat(257);
    const oversizedSession = "s".repeat(129);

    expect(
      deriveAuditIdentity(
        requestWith({
          "x-vercel-forwarded-for": oversizedIp,
          "x-real-ip": "198.51.100.9",
        }),
      ),
    ).toEqual(
      deriveAuditIdentity(requestWith({ "x-real-ip": "198.51.100.9" })),
    );

    expect(
      deriveAuditIdentity(
        requestWith({ "x-crossready-session": oversizedSession }),
      ),
    ).toEqual(deriveAuditIdentity(requestWith({})));
  });
});

describe("consumeLiveAuditBudget", () => {
  it("allows three live audits per client in ten minutes and resets the window", () => {
    const identity = deriveAuditIdentity(
      requestWith({ "x-vercel-forwarded-for": "203.0.113.20" }),
    );
    const startedAt = Date.UTC(2026, 6, 18, 0, 0, 0);

    expect(consumeLiveAuditBudget(identity, startedAt)).toMatchObject({
      allowed: true,
      limit: 3,
      remaining: 2,
      reason: null,
    });
    expect(consumeLiveAuditBudget(identity, startedAt + 1)).toMatchObject({
      allowed: true,
      limit: 3,
      remaining: 1,
      reason: null,
    });
    expect(consumeLiveAuditBudget(identity, startedAt + 2)).toMatchObject({
      allowed: true,
      limit: 3,
      remaining: 0,
      reason: null,
    });

    const blocked = consumeLiveAuditBudget(identity, startedAt + 3);
    expect(blocked).toMatchObject({
      allowed: false,
      limit: 3,
      remaining: 0,
      reason: "client_window",
      resetAt: startedAt + 10 * 60 * 1_000,
    });
    expect(blocked.safetyIdentifier).toMatch(/^audit-[a-f0-9]{16}$/);

    expect(
      consumeLiveAuditBudget(identity, startedAt + 10 * 60 * 1_000),
    ).toMatchObject({
      allowed: true,
      limit: 3,
      remaining: 2,
      reason: null,
    });
  });

  it("enforces a process-wide UTC daily budget across different clients", () => {
    process.env[CLIENT_LIMIT_ENV] = "100";
    process.env[DAILY_LIMIT_ENV] = "2";

    const firstClient = deriveAuditIdentity(
      requestWith({ "x-vercel-forwarded-for": "203.0.113.30" }),
    );
    const secondClient = deriveAuditIdentity(
      requestWith({ "x-vercel-forwarded-for": "203.0.113.31" }),
    );
    const thirdClient = deriveAuditIdentity(
      requestWith({ "x-vercel-forwarded-for": "203.0.113.32" }),
    );
    const startedAt = Date.UTC(2026, 6, 18, 23, 59, 0);

    expect(consumeLiveAuditBudget(firstClient, startedAt)).toMatchObject({
      allowed: true,
      limit: 2,
      remaining: 1,
    });
    expect(consumeLiveAuditBudget(secondClient, startedAt + 1)).toMatchObject({
      allowed: true,
      limit: 2,
      remaining: 0,
    });
    expect(consumeLiveAuditBudget(thirdClient, startedAt + 2)).toMatchObject({
      allowed: false,
      limit: 2,
      remaining: 0,
      reason: "daily_budget",
      resetAt: Date.UTC(2026, 6, 19, 0, 0, 0),
    });

    expect(
      consumeLiveAuditBudget(thirdClient, Date.UTC(2026, 6, 19, 0, 0, 0)),
    ).toMatchObject({
      allowed: true,
      limit: 2,
      remaining: 1,
      reason: null,
    });
  });

  it("uses 10 live audits as the default process-wide daily ceiling", () => {
    process.env[CLIENT_LIMIT_ENV] = "100";

    const identity = deriveAuditIdentity(
      requestWith({ "x-vercel-forwarded-for": "203.0.113.35" }),
    );
    const startedAt = Date.UTC(2026, 6, 18, 12, 0, 0);

    for (let index = 0; index < 10; index += 1) {
      expect(
        consumeLiveAuditBudget(identity, startedAt + index).allowed,
      ).toBe(true);
    }
    expect(consumeLiveAuditBudget(identity, startedAt + 10)).toMatchObject({
      allowed: false,
      limit: 10,
      remaining: 0,
      reason: "daily_budget",
      resetAt: Date.UTC(2026, 6, 19, 0, 0, 0),
    });
  });

  it("clamps configured limits to the inclusive 1 to 100 range", () => {
    process.env[CLIENT_LIMIT_ENV] = "999";
    process.env[DAILY_LIMIT_ENV] = "999";

    const identity = deriveAuditIdentity(
      requestWith({ "x-vercel-forwarded-for": "203.0.113.40" }),
    );
    const startedAt = Date.UTC(2026, 6, 18, 12, 0, 0);

    for (let index = 0; index < 100; index += 1) {
      expect(
        consumeLiveAuditBudget(identity, startedAt + index).allowed,
      ).toBe(true);
    }
    expect(consumeLiveAuditBudget(identity, startedAt + 100)).toMatchObject({
      allowed: false,
      limit: 100,
      reason: "daily_budget",
    });

    resetLiveAuditBudgetForTests();
    process.env[CLIENT_LIMIT_ENV] = "0";
    process.env[DAILY_LIMIT_ENV] = "0";

    expect(consumeLiveAuditBudget(identity, startedAt)).toMatchObject({
      allowed: true,
      limit: 1,
      remaining: 0,
    });
    expect(consumeLiveAuditBudget(identity, startedAt + 1)).toMatchObject({
      allowed: false,
      limit: 1,
      reason: "daily_budget",
    });
  });

  it("keeps counters on globalThis across module reloads", async () => {
    process.env[CLIENT_LIMIT_ENV] = "1";
    const request = requestWith({
      "x-vercel-forwarded-for": "203.0.113.50",
    });
    const startedAt = Date.UTC(2026, 6, 18, 12, 0, 0);

    const firstIdentity = deriveAuditIdentity(request);
    expect(consumeLiveAuditBudget(firstIdentity, startedAt).allowed).toBe(true);

    vi.resetModules();
    const reloaded = await import("./cost-guard");
    const reloadedIdentity = reloaded.deriveAuditIdentity(request);

    expect(reloadedIdentity).toEqual(firstIdentity);
    expect(
      reloaded.consumeLiveAuditBudget(reloadedIdentity, startedAt + 1),
    ).toMatchObject({
      allowed: false,
      limit: 1,
      reason: "client_window",
    });
  });
});
