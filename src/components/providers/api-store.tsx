"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import type { DashboardData } from "@/contracts";
import { seedLeads } from "@/lib/demo/seed";
import type { Lead as ViewLead, NewLeadInput } from "@/lib/demo/types";
import * as api from "@/lib/client/signaldesk-api";
import { toViewLead } from "@/lib/client/view-model";

const POLL_INTERVAL_MS = 1_500;
const POLL_TIMEOUT_MS = 60_000;

export interface LeadStoreValue {
  leads: ViewLead[];
  dashboard: DashboardData | null;
  hydrated: boolean;
  error: string | null;
  lastRefreshedAt: string | null;
  createLead: (input: NewLeadInput) => Promise<string>;
  processLead: (id: string, force?: boolean) => Promise<void>;
  saveDraft: (id: string, subject: string, body: string) => Promise<void>;
  approveLead: (
    id: string,
    edits?: { subject?: string; body?: string },
  ) => Promise<void>;
  sendLead: (id: string) => Promise<void>;
  rejectLead: (id: string) => Promise<void>;
  requestRewrite: (id: string) => Promise<void>;
  resetDemo: () => Promise<void>;
  refresh: () => Promise<void>;
  seedDemo: () => Promise<void>;
  clearWorkspace: () => Promise<void>;
}

const ApiStoreContext = createContext<LeadStoreValue | null>(null);

function cloneSeed(): ViewLead[] {
  return JSON.parse(JSON.stringify(seedLeads)) as ViewLead[];
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}

export function ApiStoreProvider({ children }: { children: ReactNode }) {
  const [leads, setLeads] = useState<ViewLead[]>([]);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const replaceLead = useCallback((updated: ViewLead) => {
    setLeads((current) =>
      current.map((lead) => (lead.id === updated.id ? updated : lead)),
    );
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [leadList, dashboardData] = await Promise.all([
        api.listLeads({ limit: 100 }),
        api.getDashboard(),
      ]);
      if (!mounted.current) return;
      setLeads(leadList.map(toViewLead));
      setDashboard(dashboardData);
      setError(null);
      setLastRefreshedAt(new Date().toISOString());
    } catch (caught) {
      if (!mounted.current) return;
      // Explicit fallback: keep the portfolio usable if the API is unreachable.
      setError(errorMessage(caught));
      setLeads((current) => (current.length ? current : cloneSeed()));
    } finally {
      if (mounted.current) setHydrated(true);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch resolves asynchronously
    void refresh();
  }, [refresh]);

  // Auto-refresh so live processing and new webhooks appear without a reload.
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        void refresh();
      }
    }, 12_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const awaitSettled = useCallback(
    async (id: string) => {
      const deadline = Date.now() + POLL_TIMEOUT_MS;
      while (Date.now() < deadline) {
        await sleep(POLL_INTERVAL_MS);
        const current = await api.getLead(id);
        if (!mounted.current) return;
        replaceLead(toViewLead(current));
        if (
          current.status === "READY_FOR_REVIEW" ||
          current.status === "FAILED" ||
          current.status === "APPROVED" ||
          current.status === "SENT"
        ) {
          return;
        }
      }
    },
    [replaceLead],
  );

  const createLead = useCallback(async (input: NewLeadInput) => {
    const lead = await api.createLead({
      fullName: input.fullName,
      workEmail: input.workEmail,
      companyWebsite: input.companyWebsite,
      role: input.role,
      source: "Portfolio demo form",
    });
    const view = toViewLead(lead);
    setLeads((current) => [view, ...current]);
    return view.id;
  }, []);

  const processLead = useCallback(
    async (id: string, force = false) => {
      const lead = await api.processLead(id, force);
      const view = toViewLead(lead);
      replaceLead(view);
      // Poll until the lead reaches a terminal state. This covers the async
      // (Inngest) path where the lead starts as CAPTURED/PROCESSING.
      const terminal = ["READY_FOR_REVIEW", "FAILED", "APPROVED", "SENT"];
      if (!terminal.includes(view.status)) {
        await awaitSettled(id);
      }
      void refresh();
    },
    [awaitSettled, refresh, replaceLead],
  );

  const saveDraft = useCallback(
    async (id: string, subject: string, body: string) => {
      const lead = await api.updateLeadDraft(id, { subject, body });
      replaceLead(toViewLead(lead));
    },
    [replaceLead],
  );

  const approveLead = useCallback(
    async (id: string, edits?: { subject?: string; body?: string }) => {
      // Send the latest edits directly; do NOT send a version from React state,
      // which can be stale when the user edits and approves in one action.
      const lead = await api.approveLead(id, {
        confirm: true,
        ...(edits?.subject !== undefined ? { subject: edits.subject } : {}),
        ...(edits?.body !== undefined ? { body: edits.body } : {}),
      });
      replaceLead(toViewLead(lead));
    },
    [replaceLead],
  );

  const rejectLead = useCallback(
    async (id: string) => {
      const lead = await api.rejectLead(id);
      replaceLead(toViewLead(lead));
    },
    [replaceLead],
  );

  const sendLead = useCallback(
    async (id: string) => {
      const lead = await api.sendLead(id);
      replaceLead(toViewLead(lead));
    },
    [replaceLead],
  );

  const requestRewrite = useCallback(
    async (id: string) => {
      const current = leads.find((lead) => lead.id === id);
      if (!current) return;
      const firstName = current.fullName.split(" ")[0];
      const subject = `One workflow idea for ${current.company.name}`;
      const body = `Hi ${firstName},\n\nThanks for your interest. I took a closer look at ${current.company.name} and one opportunity stood out: making the move from a new inbound signal to an informed sales response both faster and more consistent.\n\nSignalDesk prepares the company context, fit reasoning, and a source-aware draft for your team—then pauses for human approval.\n\nWould you be open to a 15-minute workflow review next week?\n\nBest,\nNadia`;
      const lead = await api.updateLeadDraft(id, { subject, body });
      replaceLead(toViewLead(lead));
    },
    [leads, replaceLead],
  );

  const resetDemo = useCallback(async () => {
    await refresh();
  }, [refresh]);

  const seedDemo = useCallback(async () => {
    await api.seedDemoWorkspace();
    await refresh();
  }, [refresh]);

  const clearWorkspace = useCallback(async () => {
    await api.resetWorkspace();
    await refresh();
  }, [refresh]);

  const value = useMemo<LeadStoreValue>(
    () => ({
      leads,
      dashboard,
      hydrated,
      error,
      lastRefreshedAt,
      createLead,
      processLead,
      saveDraft,
      approveLead,
      sendLead,
      rejectLead,
      requestRewrite,
      resetDemo,
      refresh,
      seedDemo,
      clearWorkspace,
    }),
    [
      approveLead,
      clearWorkspace,
      createLead,
      dashboard,
      error,
      hydrated,
      lastRefreshedAt,
      leads,
      processLead,
      refresh,
      rejectLead,
      requestRewrite,
      resetDemo,
      saveDraft,
      seedDemo,
      sendLead,
    ],
  );

  return (
    <ApiStoreContext.Provider value={value}>
      {children}
    </ApiStoreContext.Provider>
  );
}

export function useApiStore(): LeadStoreValue {
  const context = useContext(ApiStoreContext);
  if (!context) {
    throw new Error("useApiStore must be used within ApiStoreProvider");
  }
  return context;
}
