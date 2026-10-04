import type { Metadata } from "next";

import { NewLeadForm } from "@/components/leads/new-lead-form";

export const metadata: Metadata = {
  title: "New enrichment",
};

export default function NewLeadPage() {
  return <NewLeadForm />;
}

