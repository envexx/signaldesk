import "server-only";

import { eq } from "drizzle-orm";

import type { CompanyContext, TargetProspectProfile } from "@/contracts";

import { getDb, isDatabaseConfigured, type Database } from "@/lib/server/db/client";
import * as s from "@/lib/server/db/schema";

const SETTINGS_ID = "default";

export interface StoredEmailSettings {
  provider: "demo" | "resend";
  fromEmail: string;
  fromName: string;
  replyTo: string;
  enabled: boolean;
  apiKey: string | null;
}

export interface StoredWebhookSettings {
  inboundSignatureEnabled: boolean;
  resendSignatureEnabled: boolean;
  inboundSecret: string | null;
  resendSecret: string | null;
}

export interface StoredSettings {
  targetProspect: TargetProspectProfile;
  companyContext: CompanyContext;
  email: StoredEmailSettings;
  webhooks: StoredWebhookSettings;
  updatedAt: string;
}

export interface SettingsRepository {
  get(): Promise<StoredSettings | null>;
  save(settings: StoredSettings): Promise<void>;
}

const globalForSettings = globalThis as typeof globalThis & {
  __signaldeskSettings?: StoredSettings | null;
};

class InMemorySettingsRepository implements SettingsRepository {
  async get(): Promise<StoredSettings | null> {
    return globalForSettings.__signaldeskSettings ?? null;
  }

  async save(settings: StoredSettings): Promise<void> {
    globalForSettings.__signaldeskSettings = structuredClone(settings);
  }
}

class PostgresSettingsRepository implements SettingsRepository {
  constructor(private readonly db: Database) {}

  async get(): Promise<StoredSettings | null> {
    const rows = await this.db
      .select()
      .from(s.workspaceSettings)
      .where(eq(s.workspaceSettings.id, SETTINGS_ID))
      .limit(1);
    const row = rows[0];
    if (!row) return null;

    return {
      targetProspect: row.targetProspect as TargetProspectProfile,
      companyContext: row.companyContext as CompanyContext,
      email: (row.emailConfig ?? {}) as StoredEmailSettings,
      webhooks: (row.webhookConfig ?? {}) as StoredWebhookSettings,
      updatedAt: new Date(row.updatedAt).toISOString(),
    };
  }

  async save(settings: StoredSettings): Promise<void> {
    const values = {
      id: SETTINGS_ID,
      targetProspect: settings.targetProspect,
      companyContext: settings.companyContext,
      emailConfig: settings.email,
      webhookConfig: settings.webhooks,
      updatedAt: settings.updatedAt,
    };
    await this.db
      .insert(s.workspaceSettings)
      .values(values)
      .onConflictDoUpdate({
        target: s.workspaceSettings.id,
        set: {
          targetProspect: values.targetProspect,
          companyContext: values.companyContext,
          emailConfig: values.emailConfig,
          webhookConfig: values.webhookConfig,
          updatedAt: values.updatedAt,
        },
      });
  }
}

let cached: SettingsRepository | null = null;

export function getSettingsRepository(): SettingsRepository {
  if (cached) return cached;
  const db = getDb();
  cached =
    db && isDatabaseConfigured()
      ? new PostgresSettingsRepository(db)
      : new InMemorySettingsRepository();
  return cached;
}
