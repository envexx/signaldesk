import "server-only";

import { desc, eq } from "drizzle-orm";

import type { DeliveryRecord, DeliveryStatus } from "@/contracts";

import { getDb, isDatabaseConfigured, type Database } from "@/lib/server/db/client";
import * as s from "@/lib/server/db/schema";

export interface DeliveryRepository {
  create(record: DeliveryRecord): Promise<DeliveryRecord>;
  update(
    id: string,
    updater: (record: DeliveryRecord) => DeliveryRecord,
  ): Promise<DeliveryRecord | null>;
  list(limit: number): Promise<DeliveryRecord[]>;
  listByLead(leadId: string, limit: number): Promise<DeliveryRecord[]>;
  clearAll(): Promise<void>;
}

function iso(value: string | null): string | null {
  if (value === null) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}

const globalForDeliveries = globalThis as typeof globalThis & {
  __signaldeskDeliveries?: DeliveryRecord[];
};

class InMemoryDeliveryRepository implements DeliveryRepository {
  private rows(): DeliveryRecord[] {
    if (!globalForDeliveries.__signaldeskDeliveries) {
      globalForDeliveries.__signaldeskDeliveries = [];
    }
    return globalForDeliveries.__signaldeskDeliveries;
  }

  async create(record: DeliveryRecord): Promise<DeliveryRecord> {
    this.rows().unshift(structuredClone(record));
    return record;
  }

  async update(
    id: string,
    updater: (record: DeliveryRecord) => DeliveryRecord,
  ): Promise<DeliveryRecord | null> {
    const list = this.rows();
    const index = list.findIndex((row) => row.id === id);
    if (index === -1) return null;
    const next = updater(structuredClone(list[index]));
    list[index] = next;
    return next;
  }

  async list(limit: number): Promise<DeliveryRecord[]> {
    return this.rows()
      .slice(0, Math.max(0, limit))
      .map((row) => structuredClone(row));
  }

  async listByLead(leadId: string, limit: number): Promise<DeliveryRecord[]> {
    return this.rows()
      .filter((row) => row.leadId === leadId)
      .slice(0, Math.max(0, limit))
      .map((row) => structuredClone(row));
  }

  async clearAll(): Promise<void> {
    globalForDeliveries.__signaldeskDeliveries = [];
  }
}

class PostgresDeliveryRepository implements DeliveryRepository {
  constructor(private readonly db: Database) {}

  private toRecord(row: typeof s.emailDeliveries.$inferSelect): DeliveryRecord {
    return {
      id: row.id,
      leadId: row.leadId,
      toEmail: row.toEmail,
      subject: row.subject,
      provider: row.provider,
      status: row.status as DeliveryStatus,
      providerMessageId: row.providerMessageId,
      errorCode: row.errorCode,
      createdAt: iso(row.createdAt) ?? row.createdAt,
      updatedAt: iso(row.updatedAt) ?? row.updatedAt,
    };
  }

  async create(record: DeliveryRecord): Promise<DeliveryRecord> {
    await this.db.insert(s.emailDeliveries).values(record);
    return record;
  }

  async update(
    id: string,
    updater: (record: DeliveryRecord) => DeliveryRecord,
  ): Promise<DeliveryRecord | null> {
    const rows = await this.db
      .select()
      .from(s.emailDeliveries)
      .where(eq(s.emailDeliveries.id, id))
      .limit(1);
    if (rows.length === 0) return null;
    const next = updater(this.toRecord(rows[0]));
    await this.db
      .update(s.emailDeliveries)
      .set({
        status: next.status,
        providerMessageId: next.providerMessageId,
        errorCode: next.errorCode,
        subject: next.subject,
        updatedAt: next.updatedAt,
      })
      .where(eq(s.emailDeliveries.id, id));
    return next;
  }

  async list(limit: number): Promise<DeliveryRecord[]> {
    const rows = await this.db
      .select()
      .from(s.emailDeliveries)
      .orderBy(desc(s.emailDeliveries.createdAt))
      .limit(Math.max(0, limit));
    return rows.map((row) => this.toRecord(row));
  }

  async listByLead(leadId: string, limit: number): Promise<DeliveryRecord[]> {
    const rows = await this.db
      .select()
      .from(s.emailDeliveries)
      .where(eq(s.emailDeliveries.leadId, leadId))
      .orderBy(desc(s.emailDeliveries.createdAt))
      .limit(Math.max(0, limit));
    return rows.map((row) => this.toRecord(row));
  }

  async clearAll(): Promise<void> {
    await this.db.delete(s.emailDeliveries);
  }
}

let cached: DeliveryRepository | null = null;

export function getDeliveryRepository(): DeliveryRepository {
  if (cached) return cached;
  const db = getDb();
  cached =
    db && isDatabaseConfigured()
      ? new PostgresDeliveryRepository(db)
      : new InMemoryDeliveryRepository();
  return cached;
}
