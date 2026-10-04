"use client";

import Link from "next/link";
import {
  ArrowRight,
  Filter,
  Plus,
  Search,
  SlidersHorizontal,
  UserSearch,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";

import { useApiStore } from "@/components/providers/api-store";
import { PageLoading } from "@/components/ui/page-loading";
import { ScoreRing } from "@/components/ui/score-ring";
import { StatusPill, TierPill } from "@/components/ui/status-pill";
import type { LeadStatus, LeadTier } from "@/lib/demo/types";

const tierOptions: Array<{ value: "ALL" | LeadTier; label: string }> = [
  { value: "ALL", label: "All tiers" },
  { value: "HIGH_PRIORITY", label: "High priority" },
  { value: "MEDIUM", label: "Medium fit" },
  { value: "DISQUALIFIED", label: "Disqualified" },
  { value: "UNASSESSED", label: "Unassessed" },
];

const statusOptions: Array<{ value: "ALL" | LeadStatus; label: string }> = [
  { value: "ALL", label: "All stages" },
  { value: "READY_FOR_REVIEW", label: "Ready for review" },
  { value: "APPROVED", label: "Approved" },
  { value: "SENT", label: "Sent" },
  { value: "FAILED", label: "Needs attention" },
];

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function LeadPipeline() {
  const { leads, hydrated } = useApiStore();
  const [query, setQuery] = useState("");
  const [tier, setTier] = useState<"ALL" | LeadTier>("ALL");
  const [status, setStatus] = useState<"ALL" | LeadStatus>("ALL");

  const filteredLeads = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return leads.filter((lead) => {
      const matchesQuery =
        !normalized ||
        [lead.fullName, lead.workEmail, lead.company.name, lead.company.domain]
          .join(" ")
          .toLowerCase()
          .includes(normalized);
      const matchesTier = tier === "ALL" || lead.qualification.tier === tier;
      const matchesStatus = status === "ALL" || lead.status === status;
      return matchesQuery && matchesTier && matchesStatus;
    });
  }, [leads, query, status, tier]);

  const hasFilters = query || tier !== "ALL" || status !== "ALL";

  if (!hydrated) return <PageLoading />;

  return (
    <div className="pipeline-page">
      <section className="page-heading page-heading--split">
        <div>
          <p className="eyebrow">Lead intelligence</p>
          <h1>Pipeline</h1>
          <p>Research, prioritize, and move every inbound signal forward.</p>
        </div>
        <Link className="button button--primary" href="/leads/new">
          <Plus size={17} /> New enrichment
        </Link>
      </section>

      <section className="pipeline-toolbar" aria-label="Lead filters">
        <label className="search-field">
          <Search size={17} />
          <span className="sr-only">Search leads</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search contact, company, or email…"
          />
          {query && (
            <button type="button" aria-label="Clear search" onClick={() => setQuery("")}>
              <X size={15} />
            </button>
          )}
        </label>
        <div className="select-wrap">
          <Filter size={15} />
          <select
            aria-label="Filter by qualification tier"
            value={tier}
            onChange={(event) => setTier(event.target.value as "ALL" | LeadTier)}
          >
            {tierOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
        <div className="select-wrap">
          <SlidersHorizontal size={15} />
          <select
            aria-label="Filter by stage"
            value={status}
            onChange={(event) => setStatus(event.target.value as "ALL" | LeadStatus)}
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
        <div className="pipeline-toolbar__count">
          <strong>{filteredLeads.length}</strong> of {leads.length} leads
        </div>
      </section>

      {filteredLeads.length ? (
        <section className="lead-table-card">
          <div className="lead-table" role="table" aria-label="Lead pipeline">
            <div className="lead-table__head" role="row">
              <span role="columnheader">Lead</span>
              <span role="columnheader">Company</span>
              <span role="columnheader">ICP score</span>
              <span role="columnheader">Qualification</span>
              <span role="columnheader">Stage</span>
              <span role="columnheader">Last activity</span>
              <span role="columnheader"><span className="sr-only">Open</span></span>
            </div>
            {filteredLeads.map((lead, index) => (
              <Link className="lead-table__row" href={`/leads/${lead.id}`} key={lead.id} role="row">
                <span className="lead-person" role="cell">
                  <span className={`avatar avatar--lead avatar--tone-${(index % 4) + 1}`}>
                    {lead.initials}
                  </span>
                  <span>
                    <strong>{lead.fullName}</strong>
                    <small>{lead.workEmail}</small>
                  </span>
                </span>
                <span className="lead-company" role="cell">
                  <strong>{lead.company.name}</strong>
                  <small>{lead.company.industry}</small>
                </span>
                <span className="lead-score" role="cell">
                  <ScoreRing score={lead.qualification.score} size="small" />
                  <small aria-hidden="true">out of 100</small>
                </span>
                <span role="cell"><TierPill tier={lead.qualification.tier} /></span>
                <span role="cell"><StatusPill status={lead.status} /></span>
                <time role="cell">{formatDate(lead.updatedAt)}</time>
                <span className="lead-table__open" role="cell"><ArrowRight size={17} /></span>
              </Link>
            ))}
          </div>
        </section>
      ) : (
        <section className="empty-state">
          <span className="empty-state__icon"><UserSearch size={26} /></span>
          <h2>No leads match this view</h2>
          <p>Try a different search or clear the active filters.</p>
          {hasFilters && (
            <button
              className="button button--secondary"
              type="button"
              onClick={() => {
                setQuery("");
                setTier("ALL");
                setStatus("ALL");
              }}
            >
              <X size={16} /> Clear filters
            </button>
          )}
        </section>
      )}
    </div>
  );
}
