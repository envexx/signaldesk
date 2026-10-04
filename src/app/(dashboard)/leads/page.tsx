import type { Metadata } from "next";

import { LeadPipeline } from "@/components/leads/lead-pipeline";

export const metadata: Metadata = {
  title: "Lead pipeline",
};

export default function LeadsPage() {
  return <LeadPipeline />;
}

