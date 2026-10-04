import type { Metadata } from "next";

import { LeadWorkbench } from "@/components/leads/lead-workbench";

export const metadata: Metadata = {
  title: "Lead intelligence",
};

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <LeadWorkbench leadId={id} />;
}

