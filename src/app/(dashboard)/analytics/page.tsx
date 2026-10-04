import type { Metadata } from "next";

import { AnalyticsView } from "@/components/manage/analytics-view";

export const metadata: Metadata = {
  title: "Analytics",
};

export default function AnalyticsPage() {
  return <AnalyticsView />;
}

