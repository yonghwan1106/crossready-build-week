import { createHmac, randomBytes } from "node:crypto";
import { isIP } from "node:net";

const CLIENT_WINDOW_MS = 10 * 60 * 1_000;
const DEFAULT_CLIENT_LIMIT = 3;
const DEFAULT_DAILY_LIMIT = 10;
const MIN_CONFIGURED_LIMIT = 1;
const MAX_CONFIGURED_LIMIT = 100;
const DEFAULT_ACTIVE_AUDIT_LIMIT = 2;
const MAX_ACTIVE_AUDIT_LIMIT = 10;
const MAX_IP_HEADER_LENGTH = 256;
const MAX_SESSION_HEADER_LENGTH = 128;
const GLOBAL_STATE_KEY = "__crossreadyCostGuardStateV1" as const;

const CLIENT_LIMIT_ENV = "CROSSREADY_LIVE_AUDIT_CLIENT_LIMIT";
const DAILY_LIMIT_ENV = "CROSSREADY_LIVE_AUDIT_DAILY_LIMIT";
const ACTIVE_AUDIT_LIMIT_ENV = "CROSSREADY_ACTIVE_AUDIT_LIMIT";

export interface AuditIdentity {
  readonly fingerprint: string;
}

export interface LiveAuditBudgetDecision {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  reason: "client_window" | "daily_budget" | null;
  safetyIdentifier: string;
}

export interface AuditRequestLease {
  allowed: boolean;
  active: number;
  limit: number;
  release: () => void;
}

interface ClientWindow {
  count: number;
  resetAt: number;
}

interface DailyBudget {
  count: number;
  resetAt: number;
}

interface CostGuardState {
  version: 1;
  identitySalt: string;
  clientWindows: Map<string, ClientWindow>;
  dailyBudget: DailyBudget | null;
  activeAudits: number;
}

type CostGuardGlobal = typeof globalThis & {
  [GLOBAL_STATE_KEY]?: CostGuardState;
};

function createState(): CostGuardState {
  return {
    version: 1,
    identitySalt: randomBytes(32).toString("hex"),
    clientWindows: new Map(),
    dailyBudget: null,
    activeAudits: 0,
  };
}

function getState(): CostGuardState {
  const globalStore = globalThis as CostGuardGlobal;
  const existing = globalStore[GLOBAL_STATE_KEY];

  if (
    existing?.version === 1 &&
    existing.clientWindows instanceof Map
  ) {
    if (!Number.isSafeInteger(existing.activeAudits)) {
      existing.activeAudits = 0;
    }
    return existing;
  }

  const state = createState();
  globalStore[GLOBAL_STATE_KEY] = state;
  return state;
}

function boundedHeader(
  request: Request,
  name: string,
  maxLength: number,
): string | null {
  const value = request.headers.get(name);
  if (!value || value.length > maxLength) return null;

  const trimmed = value.trim();
  if (!trimmed || /[\u0000-\u001f\u007f]/.test(trimmed)) return null;
  return trimmed;
}

function normalizeIpToken(rawValue: string): string | null {
  let value = rawValue.trim();
  if (value.startsWith('"') && value.endsWith('"')) {
    value = value.slice(1, -1).trim();
  }

  if (isIP(value)) return value.toLowerCase();

  if (value.startsWith("[")) {
    const closingBracket = value.indexOf("]");
    if (closingBracket > 1) {
      const bracketedHost = value.slice(1, closingBracket);
      const suffix = value.slice(closingBracket + 1);
      if (
        isIP(bracketedHost) &&
        (suffix === "" || /^:\d{1,5}$/.test(suffix))
      ) {
        return bracketedHost.toLowerCase();
      }
    }
  }

  const ipv4WithPort = value.match(/^(.+):(\d{1,5})$/);
  if (ipv4WithPort && isIP(ipv4WithPort[1]) === 4) {
    return ipv4WithPort[1];
  }

  return null;
}

function firstValidIp(request: Request, headerName: string): string | null {
  const header = boundedHeader(request, headerName, MAX_IP_HEADER_LENGTH);
  if (!header) return null;

  const firstEntry = header.split(",", 1)[0];
  return firstEntry ? normalizeIpToken(firstEntry) : null;
}

function identityMaterial(request: Request): string {
  const ip =
    firstValidIp(request, "x-vercel-forwarded-for") ??
    firstValidIp(request, "x-real-ip") ??
    firstValidIp(request, "x-forwarded-for");

  if (ip) return `ip:${ip}`;

  const session = boundedHeader(
    request,
    "x-crossready-session",
    MAX_SESSION_HEADER_LENGTH,
  );
  if (session) return `session:${session}`;

  return "anonymous";
}

function hashIdentity(material: string, salt: string): string {
  return createHmac("sha256", salt).update(material).digest("hex");
}

function configuredLimit(name: string, fallback: number): number {
  const rawValue = process.env[name]?.trim();
  if (!rawValue) return fallback;

  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed)) return fallback;

  return Math.min(
    MAX_CONFIGURED_LIMIT,
    Math.max(MIN_CONFIGURED_LIMIT, Math.trunc(parsed)),
  );
}

function configuredActiveAuditLimit(): number {
  const rawValue = process.env[ACTIVE_AUDIT_LIMIT_ENV]?.trim();
  if (!rawValue) return DEFAULT_ACTIVE_AUDIT_LIMIT;

  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed)) return DEFAULT_ACTIVE_AUDIT_LIMIT;

  return Math.min(
    MAX_ACTIVE_AUDIT_LIMIT,
    Math.max(MIN_CONFIGURED_LIMIT, Math.trunc(parsed)),
  );
}

function timestampFor(now: number | Date): number {
  const timestamp = now instanceof Date ? now.getTime() : now;
  if (!Number.isFinite(timestamp)) {
    throw new TypeError("The budget timestamp must be a finite date or number.");
  }
  return timestamp;
}

function nextUtcDay(timestamp: number): number {
  const date = new Date(timestamp);
  return Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate() + 1,
  );
}

function cleanupExpiredClientWindows(
  state: CostGuardState,
  timestamp: number,
): void {
  for (const [fingerprint, window] of state.clientWindows) {
    if (window.resetAt <= timestamp) {
      state.clientWindows.delete(fingerprint);
    }
  }
}

function currentDailyBudget(
  state: CostGuardState,
  timestamp: number,
): DailyBudget {
  if (!state.dailyBudget || state.dailyBudget.resetAt <= timestamp) {
    state.dailyBudget = {
      count: 0,
      resetAt: nextUtcDay(timestamp),
    };
  }
  return state.dailyBudget;
}

function currentClientWindow(
  state: CostGuardState,
  fingerprint: string,
  timestamp: number,
): ClientWindow {
  const existing = state.clientWindows.get(fingerprint);
  if (existing && existing.resetAt > timestamp) return existing;

  const window = {
    count: 0,
    resetAt: timestamp + CLIENT_WINDOW_MS,
  };
  state.clientWindows.set(fingerprint, window);
  return window;
}

function normalizedFingerprint(
  identity: AuditIdentity,
  state: CostGuardState,
): string {
  if (/^[a-f0-9]{64}$/.test(identity.fingerprint)) {
    return identity.fingerprint;
  }
  return hashIdentity(`untrusted:${identity.fingerprint}`, state.identitySalt);
}

function decision(
  fingerprint: string,
  allowed: boolean,
  limit: number,
  remaining: number,
  resetAt: number,
  reason: LiveAuditBudgetDecision["reason"],
): LiveAuditBudgetDecision {
  return {
    allowed,
    limit,
    remaining,
    resetAt,
    reason,
    safetyIdentifier: `audit-${fingerprint.slice(0, 16)}`,
  };
}

export function deriveAuditIdentity(request: Request): AuditIdentity {
  const state = getState();
  return Object.freeze({
    fingerprint: hashIdentity(identityMaterial(request), state.identitySalt),
  });
}

export function acquireAuditRequestSlot(): AuditRequestLease {
  const state = getState();
  const limit = configuredActiveAuditLimit();

  if (state.activeAudits >= limit) {
    return {
      allowed: false,
      active: state.activeAudits,
      limit,
      release: () => {},
    };
  }

  state.activeAudits += 1;
  let released = false;

  return {
    allowed: true,
    active: state.activeAudits,
    limit,
    release: () => {
      if (released) return;
      released = true;
      state.activeAudits = Math.max(0, state.activeAudits - 1);
    },
  };
}

export function consumeLiveAuditBudget(
  identity: AuditIdentity,
  now: number | Date = Date.now(),
): LiveAuditBudgetDecision {
  const timestamp = timestampFor(now);
  const state = getState();
  const fingerprint = normalizedFingerprint(identity, state);
  const clientLimit = configuredLimit(CLIENT_LIMIT_ENV, DEFAULT_CLIENT_LIMIT);
  const dailyLimit = configuredLimit(DAILY_LIMIT_ENV, DEFAULT_DAILY_LIMIT);

  cleanupExpiredClientWindows(state, timestamp);
  const dailyBudget = currentDailyBudget(state, timestamp);

  if (dailyBudget.count >= dailyLimit) {
    return decision(
      fingerprint,
      false,
      dailyLimit,
      0,
      dailyBudget.resetAt,
      "daily_budget",
    );
  }

  const clientWindow = currentClientWindow(state, fingerprint, timestamp);
  if (clientWindow.count >= clientLimit) {
    return decision(
      fingerprint,
      false,
      clientLimit,
      0,
      clientWindow.resetAt,
      "client_window",
    );
  }

  clientWindow.count += 1;
  dailyBudget.count += 1;

  const clientRemaining = clientLimit - clientWindow.count;
  const dailyRemaining = dailyLimit - dailyBudget.count;

  if (dailyRemaining < clientRemaining) {
    return decision(
      fingerprint,
      true,
      dailyLimit,
      dailyRemaining,
      dailyBudget.resetAt,
      null,
    );
  }

  return decision(
    fingerprint,
    true,
    clientLimit,
    clientRemaining,
    clientWindow.resetAt,
    null,
  );
}

export function resetLiveAuditBudgetForTests(): void {
  const state = getState();
  state.clientWindows.clear();
  state.dailyBudget = null;
  state.activeAudits = 0;
}
