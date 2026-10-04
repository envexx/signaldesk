import { AlertTriangle, ArrowUpRight, Check, Clock3, X } from "lucide-react";

import {
  statusLabels,
  tierLabels,
  type LeadStatus,
  type LeadTier,
} from "@/lib/demo/types";

export function TierPill({ tier }: { tier: LeadTier }) {
  const icon =
    tier === "HIGH_PRIORITY" ? (
      <ArrowUpRight size={12} />
    ) : tier === "DISQUALIFIED" ? (
      <X size={12} />
    ) : tier === "UNASSESSED" ? (
      <AlertTriangle size={12} />
    ) : null;

  return (
    <span className={`pill pill--tier pill--${tier.toLowerCase()}`}>
      {icon}
      {tierLabels[tier]}
    </span>
  );
}

export function StatusPill({ status }: { status: LeadStatus }) {
  const icon =
    status === "APPROVED" || status === "SENT" ? (
      <Check size={12} />
    ) : status === "FAILED" ? (
      <AlertTriangle size={12} />
    ) : status === "PROCESSING" ? (
      <Clock3 size={12} />
    ) : null;

  return (
    <span className={`pill pill--status pill--${status.toLowerCase()}`}>
      {icon}
      {statusLabels[status]}
    </span>
  );
}

export function ConfidencePill({ value }: { value: "HIGH" | "MEDIUM" | "LOW" }) {
  return (
    <span className={`confidence confidence--${value.toLowerCase()}`}>
      {value.toLowerCase()} confidence
    </span>
  );
}
