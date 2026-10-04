/**
 * Outbox / delivery records. Every send attempt (real or demo) is recorded so
 * the pipeline visibly completes and delivery history is auditable.
 */

export const DELIVERY_STATUSES = ["SENT", "SIMULATED", "FAILED"] as const;

export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

export interface DeliveryRecord {
  id: string;
  leadId: string;
  toEmail: string;
  subject: string;
  provider: string;
  status: DeliveryStatus;
  providerMessageId: string | null;
  errorCode: string | null;
  createdAt: string;
  updatedAt: string;
}
