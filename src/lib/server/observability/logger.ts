import "server-only";

import { getRequestContext } from "./context";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogFields {
  leadId?: string;
  workflowRunId?: string;
  stepKey?: string;
  provider?: string;
  durationMs?: number;
  outcome?: string;
  errorCode?: string;
  [key: string]: unknown;
}

const SECRET_KEY = /(secret|token|password|authorization|api[-_]?key|dsn)/i;
const EMAIL = /([a-z0-9._%+-]+)@([a-z0-9.-]+\.[a-z]{2,})/gi;

/** Mask an email for logs while keeping it recognizable, e.g. `m***@acme.com`. */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at <= 0) return "***";
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const visible = local.slice(0, 1);
  return `${visible}***@${domain}`;
}

function sanitizeValue(value: unknown): unknown {
  if (typeof value === "string") {
    return value.replace(EMAIL, (_match, local: string, domain: string) => {
      return `${local.slice(0, 1)}***@${domain}`;
    });
  }
  if (Array.isArray(value)) return value.map(sanitizeValue);
  if (value && typeof value === "object") return sanitizeFields(value as LogFields);
  return value;
}

function sanitizeFields(fields: LogFields): LogFields {
  const out: LogFields = {};
  for (const [key, value] of Object.entries(fields)) {
    if (SECRET_KEY.test(key)) {
      out[key] = "[redacted]";
    } else {
      out[key] = sanitizeValue(value);
    }
  }
  return out;
}

/** Structured single-line JSON logs with correlation id and PII masking. */
export function log(
  level: LogLevel,
  message: string,
  fields: LogFields = {},
): void {
  const context = getRequestContext();
  const entry = {
    time: new Date().toISOString(),
    level,
    message,
    requestId: context?.requestId,
    leadId: context?.leadId,
    workflowRunId: context?.workflowRunId,
    stepKey: context?.stepKey,
    provider: context?.provider,
    ...sanitizeFields(fields),
  };

  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (message: string, fields?: LogFields) => log("debug", message, fields),
  info: (message: string, fields?: LogFields) => log("info", message, fields),
  warn: (message: string, fields?: LogFields) => log("warn", message, fields),
  error: (message: string, fields?: LogFields) => log("error", message, fields),
};
