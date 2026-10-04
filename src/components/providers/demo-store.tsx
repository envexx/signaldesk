"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { seedLeads } from "@/lib/demo/seed";
import type { Lead, NewLeadInput } from "@/lib/demo/types";

const STORAGE_KEY = "signaldesk-demo-leads-v1";

interface DemoStoreValue {
  leads: Lead[];
  hydrated: boolean;
  createLead: (input: NewLeadInput) => string;
  processLead: (id: string) => void;
  saveDraft: (id: string, subject: string, body: string) => void;
  approveLead: (id: string) => void;
  rejectLead: (id: string) => void;
  requestRewrite: (id: string) => void;
  resetDemo: () => void;
}

const DemoStoreContext = createContext<DemoStoreValue | null>(null);

function cloneSeed(): Lead[] {
  return JSON.parse(JSON.stringify(seedLeads)) as Lead[];
}

function initialsFromName(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function domainFromWebsite(website: string) {
  return website
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .split("/")[0]
    .toLowerCase();
}

function companyFromDomain(domain: string) {
  return domain
    .split(".")[0]
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function createCapturedLead(input: NewLeadInput, id: string): Lead {
  const domain = domainFromWebsite(input.companyWebsite);
  const now = new Date().toISOString();

  return {
    id,
    fullName: input.fullName.trim(),
    initials: initialsFromName(input.fullName),
    workEmail: input.workEmail.trim().toLowerCase(),
    role: input.role?.trim() || "Role not provided",
    source: "Portfolio demo form",
    company: {
      name: companyFromDomain(domain),
      domain,
      website: `https://${domain}`,
      industry: "Researching…",
      estimatedSize: "Researching…",
      businessModel: "Researching…",
      location: "Researching…",
      summary: "Company intelligence is being prepared.",
      technologies: [],
    },
    qualification: {
      score: 0,
      tier: "UNASSESSED",
      reasoning: "This lead has not been scored yet.",
      criteria: {
        companyFit: 0,
        problemFit: 0,
        buyingSignal: 0,
        dataConfidence: 0,
      },
      riskFlags: input.workEmail.match(/@(gmail|yahoo|hotmail|outlook)\./i)
        ? ["Free email provider detected"]
        : [],
    },
    enrichment: {
      painPoints: [],
      evidence: [
        {
          id: `${id}-form`,
          label: "Contact details supplied through the portfolio demo form",
          sourceType: "FORM_INPUT",
          confidence: "HIGH",
        },
      ],
      confidence: "LOW",
    },
    draft: {
      subject: "",
      body: "",
      status: "DRAFT",
      lastEditedAt: now,
    },
    workflow: [
      {
        id: "captured",
        title: "Lead captured",
        status: "SUCCEEDED",
        timestamp: now,
        durationMs: 34,
        detail: "Demo form data normalized in the browser.",
      },
      {
        id: "researched",
        title: "Company research",
        status: "RUNNING",
        timestamp: now,
        detail: "Running deterministic demo enrichment.",
      },
      {
        id: "scored",
        title: "ICP fit scoring",
        status: "PENDING",
        detail: "Waiting for company intelligence.",
      },
      {
        id: "drafted",
        title: "Nurture draft",
        status: "PENDING",
        detail: "Waiting for qualification.",
      },
      {
        id: "approval",
        title: "Human approval",
        status: "PENDING",
        detail: "No draft is ready yet.",
      },
    ],
    status: "PROCESSING",
    createdAt: now,
    updatedAt: now,
  };
}

export function DemoStoreProvider({ children }: { children: ReactNode }) {
  const [leads, setLeads] = useState<Lead[]>(() => cloneSeed());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let restoredLeads: Lead[] | null = null;
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        restoredLeads = JSON.parse(stored) as Lead[];
      }
    } catch {
      // The seeded demo remains available if local storage is unavailable.
    }

    const hydrationTimer = window.setTimeout(() => {
      if (restoredLeads) setLeads(restoredLeads);
      setHydrated(true);
    }, 0);

    return () => window.clearTimeout(hydrationTimer);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(leads));
  }, [hydrated, leads]);

  const createLead = useCallback((input: NewLeadInput) => {
    const id = `lead-${Date.now().toString(36)}`;
    const lead = createCapturedLead(input, id);
    setLeads((current) => [lead, ...current]);
    return id;
  }, []);

  const processLead = useCallback((id: string) => {
    const now = new Date().toISOString();
    setLeads((current) =>
      current.map((lead) => {
        if (lead.id !== id) return lead;

        const companyName = lead.company.name;
        const roleSignal = lead.role === "Role not provided" ? 11 : 17;
        const freeEmailRisk = lead.qualification.riskFlags.includes(
          "Free email provider detected",
        );
        const score = freeEmailRisk ? 57 : 84;

        return {
          ...lead,
          company: {
            ...lead.company,
            industry: "B2B technology",
            estimatedSize: "51–200 employees",
            businessModel: "B2B SaaS",
            location: "Southeast Asia",
            summary: `${companyName} appears to help business teams manage complex operational work through a digital platform. This is deterministic demo content, not live web research.`,
            technologies: ["React", "HubSpot", "Cloud infrastructure"],
          },
          qualification: {
            score,
            tier: score >= 75 ? "HIGH_PRIORITY" : "MEDIUM",
            reasoning: freeEmailRisk
              ? "The company profile is relevant, but a free-email address reduces identity confidence and should be verified by a human."
              : "Strong company fit, a relevant operations problem, and a role signal that suggests ownership of the workflow.",
            criteria: {
              companyFit: freeEmailRisk ? 22 : 31,
              problemFit: 25,
              buyingSignal: roleSignal,
              dataConfidence: freeEmailRisk ? 10 : 11,
            },
            riskFlags: lead.qualification.riskFlags,
          },
          enrichment: {
            confidence: freeEmailRisk ? "MEDIUM" : "HIGH",
            painPoints: [
              "Inbound research may slow down as lead volume grows.",
              "Manual qualification creates inconsistent prioritization.",
              "Generic follow-up can miss company-specific context.",
            ],
            evidence: [
              ...lead.enrichment.evidence,
              {
                id: `${id}-demo-inference`,
                label:
                  "Operational context generated by the frontend demo adapter",
                sourceType: "AI_INFERENCE",
                confidence: "MEDIUM",
              },
            ],
          },
          draft: {
            subject: `A faster inbound workflow for ${companyName}`,
            body: `Hi ${lead.fullName.split(" ")[0]},\n\nThanks for exploring SignalDesk. Based on the context you shared, ${companyName} looks like the kind of growing B2B team where inbound research and qualification can quickly become repetitive.\n\nWe help growth teams turn a simple form submission into an evidence-backed account brief and a relevant follow-up draft—while keeping a human in control before anything is sent.\n\nWould a short walkthrough using one of your current lead workflows be useful?\n\nBest,\nNadia`,
            status: "DRAFT",
            lastEditedAt: now,
          },
          workflow: [
            lead.workflow[0],
            {
              id: "researched",
              title: "Company researched",
              status: "SUCCEEDED",
              timestamp: now,
              durationMs: 3_840,
              detail: "Deterministic demo intelligence prepared.",
            },
            {
              id: "scored",
              title: "ICP fit scored",
              status: "SUCCEEDED",
              timestamp: now,
              durationMs: 910,
              detail: "Fit rubric evaluated with demo signals.",
            },
            {
              id: "drafted",
              title: "Nurture draft created",
              status: "SUCCEEDED",
              timestamp: now,
              durationMs: 1_240,
              detail: "Contextual inbound follow-up prepared.",
            },
            {
              id: "approval",
              title: "Awaiting approval",
              status: "RUNNING",
              timestamp: now,
              detail: "A human review is required before delivery.",
            },
          ],
          status: "READY_FOR_REVIEW",
          updatedAt: now,
          processingDurationMs: 6_024,
        };
      }),
    );
  }, []);

  const saveDraft = useCallback(
    (id: string, subject: string, body: string) => {
      const now = new Date().toISOString();
      setLeads((current) =>
        current.map((lead) =>
          lead.id === id
            ? {
                ...lead,
                draft: {
                  ...lead.draft,
                  subject,
                  body,
                  lastEditedAt: now,
                },
                updatedAt: now,
              }
            : lead,
        ),
      );
    },
    [],
  );

  const approveLead = useCallback((id: string) => {
    const now = new Date().toISOString();
    setLeads((current) =>
      current.map((lead) =>
        lead.id === id
          ? {
              ...lead,
              status: "APPROVED",
              draft: { ...lead.draft, status: "APPROVED", lastEditedAt: now },
              workflow: lead.workflow.map((step) =>
                step.id === "approval"
                  ? {
                      ...step,
                      title: "Draft approved",
                      status: "SUCCEEDED",
                      timestamp: now,
                      detail:
                        "Approved in demo mode. No external email was sent.",
                    }
                  : step,
              ),
              updatedAt: now,
            }
          : lead,
      ),
    );
  }, []);

  const rejectLead = useCallback((id: string) => {
    const now = new Date().toISOString();
    setLeads((current) =>
      current.map((lead) =>
        lead.id === id
          ? {
              ...lead,
              draft: { ...lead.draft, status: "REJECTED", lastEditedAt: now },
              updatedAt: now,
            }
          : lead,
      ),
    );
  }, []);

  const requestRewrite = useCallback((id: string) => {
    const now = new Date().toISOString();
    setLeads((current) =>
      current.map((lead) => {
        if (lead.id !== id) return lead;
        const firstName = lead.fullName.split(" ")[0];
        return {
          ...lead,
          draft: {
            ...lead.draft,
            subject: `One workflow idea for ${lead.company.name}`,
            body: `Hi ${firstName},\n\nThanks for your interest. I took a closer look at ${lead.company.name} and one opportunity stood out: making the move from a new inbound signal to an informed sales response both faster and more consistent.\n\nSignalDesk prepares the company context, fit reasoning, and a source-aware draft for your team—then pauses for human approval.\n\nWould you be open to a 15-minute workflow review next week?\n\nBest,\nNadia`,
            status: "DRAFT",
            lastEditedAt: now,
          },
          updatedAt: now,
        };
      }),
    );
  }, []);

  const resetDemo = useCallback(() => {
    setLeads(cloneSeed());
  }, []);

  const value = useMemo<DemoStoreValue>(
    () => ({
      leads,
      hydrated,
      createLead,
      processLead,
      saveDraft,
      approveLead,
      rejectLead,
      requestRewrite,
      resetDemo,
    }),
    [
      approveLead,
      createLead,
      hydrated,
      leads,
      processLead,
      rejectLead,
      requestRewrite,
      resetDemo,
      saveDraft,
    ],
  );

  return (
    <DemoStoreContext.Provider value={value}>
      {children}
    </DemoStoreContext.Provider>
  );
}

export function useDemoStore() {
  const context = useContext(DemoStoreContext);
  if (!context) {
    throw new Error("useDemoStore must be used within DemoStoreProvider");
  }
  return context;
}
