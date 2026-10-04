import type { Metadata } from "next";

import { OutboxView } from "@/components/manage/outbox-view";

export const metadata: Metadata = {
  title: "Outbox",
};

export default function OutboxPage() {
  return <OutboxView />;
}
