"use client";

import { MailCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import type { DeliveryRecord, DeliveryStatus } from "@/contracts";
import { listOutbox } from "@/lib/client/signaldesk-api";
import { PageLoading } from "@/components/ui/page-loading";

const STATUS_LABEL: Record<DeliveryStatus, string> = {
  SENT: "Sent",
  SIMULATED: "Simulated (demo)",
  FAILED: "Failed",
};

function formatTime(iso: string): string {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function OutboxView() {
  const [items, setItems] = useState<DeliveryRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setItems(await listOutbox(100));
      setError(null);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not load the outbox.",
      );
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch
    void load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 15_000);
    return () => window.clearInterval(timer);
  }, [load]);

  if (!items) {
    return error ? (
      <p className="field-error" role="alert">
        {error}
      </p>
    ) : (
      <PageLoading />
    );
  }

  const sent = items.filter((item) => item.status === "SENT").length;
  const simulated = items.filter((item) => item.status === "SIMULATED").length;
  const failed = items.filter((item) => item.status === "FAILED").length;

  return (
    <div className="manage-page">
      <section className="page-heading page-heading--split">
        <div>
          <p className="eyebrow">Delivery</p>
          <h1>Outbox</h1>
          <p>
            Every send attempt is recorded here — real Resend deliveries and
            demo simulations alike.
          </p>
        </div>
        <span className="settings-mode">
          <MailCheck size={14} /> {sent} sent · {simulated} simulated · {failed}{" "}
          failed
        </span>
      </section>

      <article className="panel settings-section">
        <div className="panel__header">
          <div>
            <p className="panel-kicker">Delivery history</p>
            <h2>Recent messages</h2>
          </div>
        </div>

        {items.length === 0 ? (
          <p className="muted-copy">
            No messages yet. Approve a draft and send it to see it here.
          </p>
        ) : (
          <div className="outbox-table">
            <div className="outbox-row outbox-row--head">
              <span>Time</span>
              <span>Recipient / subject</span>
              <span>Lead</span>
              <span>Provider</span>
              <span>Status</span>
            </div>
            {items.map((item) => (
              <div className="outbox-row" key={item.id}>
                <span>{formatTime(item.createdAt)}</span>
                <span>
                  <strong>{item.subject}</strong>
                  <small>{item.toEmail}</small>
                </span>
                <span>{item.leadId}</span>
                <span>{item.provider}</span>
                <span>
                  <span
                    className={`outbox-badge outbox-badge--${item.status.toLowerCase()}`}
                  >
                    {STATUS_LABEL[item.status]}
                  </span>
                </span>
              </div>
            ))}
          </div>
        )}
      </article>
    </div>
  );
}
