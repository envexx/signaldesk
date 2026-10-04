import "server-only";

import type { DeliveryRecord } from "@/contracts";

import { getDeliveryRepository } from "@/lib/server/repositories/delivery-repository";

export async function listDeliveries(limit = 50): Promise<DeliveryRecord[]> {
  return getDeliveryRepository().list(limit);
}

export async function listLeadDeliveries(
  leadId: string,
  limit = 10,
): Promise<DeliveryRecord[]> {
  return getDeliveryRepository().listByLead(leadId, limit);
}
