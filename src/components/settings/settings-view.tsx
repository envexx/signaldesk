"use client";

import {
  BookMarked,
  CheckCircle2,
  Mail,
  Save,
  Send,
  Server,
  Target,
  Webhook,
} from "lucide-react";
import { useEffect, useState } from "react";

import type {
  CompanyContext,
  EmailSettingsInput,
  HealthData,
  TargetProspectProfile,
  UpdateSettingsInput,
  WebhookSettingsInput,
  WorkspaceSettings,
} from "@/contracts";
import {
  getHealth,
  getSettings,
  sendTestWebhook,
  testEmail,
  updateSettings,
} from "@/lib/client/signaldesk-api";
import { PageLoading } from "@/components/ui/page-loading";

type TabKey = "target" | "company" | "email" | "webhooks" | "system";

const TABS: Array<{ key: TabKey; label: string; icon: typeof Target }> = [
  { key: "target", label: "Target prospect", icon: Target },
  { key: "company", label: "Company context", icon: BookMarked },
  { key: "email", label: "Email", icon: Mail },
  { key: "webhooks", label: "Webhooks", icon: Webhook },
  { key: "system", label: "System", icon: Server },
];

function linesToArray(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function arrayToLines(values: string[]): string {
  return values.join("\n");
}

function csvToArray(text: string): string[] {
  return text
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function arrayToCsv(values: string[]): string {
  return values.join(", ");
}

function toDraft(settings: WorkspaceSettings): UpdateSettingsInput {
  return {
    targetProspect: settings.targetProspect,
    companyContext: settings.companyContext,
    email: {
      provider: settings.email.provider,
      fromEmail: settings.email.fromEmail,
      fromName: settings.email.fromName,
      replyTo: settings.email.replyTo,
      enabled: settings.email.enabled,
    },
    webhooks: {
      inboundSignatureEnabled: settings.webhooks.inboundSignatureEnabled,
      resendSignatureEnabled: settings.webhooks.resendSignatureEnabled,
    },
  };
}

interface SecretInputs {
  apiKey: string;
  inboundSecret: string;
  resendSecret: string;
}

const EMPTY_SECRETS: SecretInputs = {
  apiKey: "",
  inboundSecret: "",
  resendSecret: "",
};

export function SettingsView() {
  const [tab, setTab] = useState<TabKey>("target");
  const [draft, setDraft] = useState<UpdateSettingsInput | null>(null);
  const [secrets, setSecrets] = useState<SecretInputs>(EMPTY_SECRETS);
  const [meta, setMeta] = useState({
    hasApiKey: false,
    hasInboundSecret: false,
    hasResendSecret: false,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<HealthData | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [emailTestTo, setEmailTestTo] = useState("");
  const [emailTesting, setEmailTesting] = useState(false);
  const [emailTestResult, setEmailTestResult] = useState<string | null>(null);

  const applySettings = (settings: WorkspaceSettings) => {
    setDraft(toDraft(settings));
    setMeta({
      hasApiKey: settings.email.hasApiKey,
      hasInboundSecret: settings.webhooks.hasInboundSecret,
      hasResendSecret: settings.webhooks.hasResendSecret,
    });
  };

  useEffect(() => {
    let active = true;
    getSettings()
      .then((settings) => {
        if (active) applySettings(settings);
      })
      .catch((caught) => {
        if (active)
          setError(
            caught instanceof Error ? caught.message : "Could not load settings.",
          );
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    getHealth()
      .then(setHealth)
      .catch(() => setHealth(null));
  }, []);

  const setTarget = (patch: Partial<TargetProspectProfile>) => {
    setSaved(false);
    setDraft((current) =>
      current
        ? { ...current, targetProspect: { ...current.targetProspect, ...patch } }
        : current,
    );
  };

  const setCompany = (patch: Partial<CompanyContext>) => {
    setSaved(false);
    setDraft((current) =>
      current
        ? { ...current, companyContext: { ...current.companyContext, ...patch } }
        : current,
    );
  };

  const setEmail = (patch: Partial<EmailSettingsInput>) => {
    setSaved(false);
    setDraft((current) =>
      current ? { ...current, email: { ...current.email, ...patch } } : current,
    );
  };

  const setWebhooks = (patch: Partial<WebhookSettingsInput>) => {
    setSaved(false);
    setDraft((current) =>
      current
        ? { ...current, webhooks: { ...current.webhooks, ...patch } }
        : current,
    );
  };

  const handleSave = async () => {
    if (!draft) return;
    setSaving(true);
    setError(null);

    const payload: UpdateSettingsInput = {
      ...draft,
      email: {
        ...draft.email,
        ...(secrets.apiKey.trim() ? { apiKey: secrets.apiKey.trim() } : {}),
      },
      webhooks: {
        ...draft.webhooks,
        ...(secrets.inboundSecret.trim()
          ? { inboundSecret: secrets.inboundSecret.trim() }
          : {}),
        ...(secrets.resendSecret.trim()
          ? { resendSecret: secrets.resendSecret.trim() }
          : {}),
      },
    };

    try {
      const savedSettings = await updateSettings(payload);
      applySettings(savedSettings);
      setSecrets(EMPTY_SECRETS);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 4_000);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not save settings.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleTestWebhook = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const lead = await sendTestWebhook();
      setTestResult(
        `Webhook accepted → ${lead.contact.fullName} (${lead.company.name}). Check the pipeline.`,
      );
    } catch (caught) {
      setTestResult(
        caught instanceof Error ? caught.message : "Webhook test failed.",
      );
    } finally {
      setTesting(false);
    }
  };

  const handleTestEmail = async () => {
    setEmailTesting(true);
    setEmailTestResult(null);
    try {
      const result = await testEmail(emailTestTo.trim() || undefined);
      setEmailTestResult(
        result.sent
          ? `Test email sent to ${result.to} (id ${result.messageId ?? "—"}).`
          : result.message ?? "Resend is not enabled.",
      );
    } catch (caught) {
      setEmailTestResult(
        caught instanceof Error ? caught.message : "Test email failed.",
      );
    } finally {
      setEmailTesting(false);
    }
  };

  if (!draft) {
    return error ? (
      <p className="field-error" role="alert">
        {error}
      </p>
    ) : (
      <PageLoading />
    );
  }

  const target = draft.targetProspect;
  const company = draft.companyContext;
  const email = draft.email;
  const webhooks = draft.webhooks;
  const origin =
    typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="settings-page">
      <section className="page-heading page-heading--split">
        <div>
          <p className="eyebrow">Workspace</p>
          <h1>Settings</h1>
          <p>
            Configure your ICP, company context, email delivery, and webhook
            security.
          </p>
        </div>
      </section>

      {saved && (
        <div className="settings-saved" role="status">
          <CheckCircle2 size={15} /> Settings saved. New enrichments use them
          immediately.
        </div>
      )}
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}

      <div className="settings-tabs" role="tablist" aria-label="Settings sections">
        {TABS.map((item) => {
          const Icon = item.icon;
          const active = tab === item.key;
          return (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={active}
              className={`settings-tab ${active ? "settings-tab--active" : ""}`}
              onClick={() => setTab(item.key)}
            >
              <Icon size={16} />
              {item.label}
            </button>
          );
        })}
      </div>

      <div className="settings-main">
          {tab === "target" && (
            <article className="panel settings-section">
              <div className="settings-section__header">
                <span>
                  <Target size={18} />
                </span>
                <div>
                  <h2>Target prospect data</h2>
                  <p>
                    Who is a good fit (ICP). Drives relevance scoring and risk
                    flags.
                  </p>
                </div>
              </div>
              <div className="settings-field-grid">
                <label>
                  <span>Ideal industries (comma separated)</span>
                  <input
                    value={arrayToCsv(target.industries)}
                    onChange={(event) =>
                      setTarget({ industries: csvToArray(event.target.value) })
                    }
                  />
                </label>
                <label>
                  <span>Company sizes (comma separated)</span>
                  <input
                    value={arrayToCsv(target.companySizes)}
                    onChange={(event) =>
                      setTarget({ companySizes: csvToArray(event.target.value) })
                    }
                  />
                </label>
                <label>
                  <span>Regions (comma separated)</span>
                  <input
                    value={arrayToCsv(target.regions)}
                    onChange={(event) =>
                      setTarget({ regions: csvToArray(event.target.value) })
                    }
                  />
                </label>
                <label>
                  <span>Decision-maker roles (comma separated)</span>
                  <input
                    value={arrayToCsv(target.roles)}
                    onChange={(event) =>
                      setTarget({ roles: csvToArray(event.target.value) })
                    }
                  />
                </label>
                <label className="field-span">
                  <span>Pain points you solve (one per line)</span>
                  <textarea
                    value={arrayToLines(target.painPoints)}
                    onChange={(event) =>
                      setTarget({ painPoints: linesToArray(event.target.value) })
                    }
                  />
                </label>
                <label className="field-span">
                  <span>Buying signals (one per line)</span>
                  <textarea
                    value={arrayToLines(target.buyingSignals)}
                    onChange={(event) =>
                      setTarget({
                        buyingSignals: linesToArray(event.target.value),
                      })
                    }
                  />
                </label>
                <label className="field-span">
                  <span>Disqualifiers (one per line)</span>
                  <textarea
                    value={arrayToLines(target.disqualifiers)}
                    onChange={(event) =>
                      setTarget({
                        disqualifiers: linesToArray(event.target.value),
                      })
                    }
                  />
                </label>
                <label className="field-span">
                  <span>Extra targeting notes</span>
                  <textarea
                    value={target.notes}
                    onChange={(event) => setTarget({ notes: event.target.value })}
                  />
                </label>
              </div>
            </article>
          )}

          {tab === "company" && (
            <article className="panel settings-section">
              <div className="settings-section__header">
                <span>
                  <BookMarked size={18} />
                </span>
                <div>
                  <h2>Company context docs (your reference)</h2>
                  <p>
                    Value proposition, offerings, proof, tone and CTA for
                    accurate copywriting.
                  </p>
                </div>
              </div>
              <div className="settings-field-grid">
                <label>
                  <span>Company name</span>
                  <input
                    value={company.companyName}
                    onChange={(event) =>
                      setCompany({ companyName: event.target.value })
                    }
                  />
                </label>
                <label>
                  <span>Website</span>
                  <input
                    value={company.website}
                    onChange={(event) =>
                      setCompany({ website: event.target.value })
                    }
                  />
                </label>
                <label className="field-span">
                  <span>Value proposition</span>
                  <textarea
                    value={company.valueProposition}
                    onChange={(event) =>
                      setCompany({ valueProposition: event.target.value })
                    }
                  />
                </label>
                <label className="field-span">
                  <span>Offerings (one per line)</span>
                  <textarea
                    value={arrayToLines(company.offerings)}
                    onChange={(event) =>
                      setCompany({ offerings: linesToArray(event.target.value) })
                    }
                  />
                </label>
                <label className="field-span">
                  <span>Differentiators (one per line)</span>
                  <textarea
                    value={arrayToLines(company.differentiators)}
                    onChange={(event) =>
                      setCompany({
                        differentiators: linesToArray(event.target.value),
                      })
                    }
                  />
                </label>
                <label className="field-span">
                  <span>Proof / case studies (one per line)</span>
                  <textarea
                    value={arrayToLines(company.caseStudies)}
                    onChange={(event) =>
                      setCompany({
                        caseStudies: linesToArray(event.target.value),
                      })
                    }
                  />
                </label>
                <label>
                  <span>Tone</span>
                  <input
                    value={company.tone}
                    onChange={(event) =>
                      setCompany({ tone: event.target.value })
                    }
                  />
                </label>
                <label>
                  <span>Call to action</span>
                  <input
                    value={company.callToAction}
                    onChange={(event) =>
                      setCompany({ callToAction: event.target.value })
                    }
                  />
                </label>
                <label>
                  <span>Email signature</span>
                  <input
                    value={company.signature}
                    onChange={(event) =>
                      setCompany({ signature: event.target.value })
                    }
                  />
                </label>
                <label className="field-span">
                  <span>Guardrails / notes</span>
                  <textarea
                    value={company.notes}
                    onChange={(event) =>
                      setCompany({ notes: event.target.value })
                    }
                  />
                </label>
              </div>
            </article>
          )}

          {tab === "email" && (
            <article className="panel settings-section">
              <div className="settings-section__header">
                <span>
                  <Mail size={18} />
                </span>
                <div>
                  <h2>Email delivery</h2>
                  <p>
                    Configure Resend so approved drafts can actually be sent.
                    Leave as demo to keep sending disabled.
                  </p>
                </div>
              </div>
              <div className="settings-field-grid">
                <label>
                  <span>Provider</span>
                  <select
                    value={email.provider}
                    onChange={(event) =>
                      setEmail({
                        provider: event.target.value as EmailSettingsInput["provider"],
                      })
                    }
                  >
                    <option value="demo">Demo (no external send)</option>
                    <option value="resend">Resend</option>
                  </select>
                </label>
                <label>
                  <span>Send enabled</span>
                  <select
                    value={email.enabled ? "yes" : "no"}
                    onChange={(event) =>
                      setEmail({ enabled: event.target.value === "yes" })
                    }
                  >
                    <option value="yes">Enabled</option>
                    <option value="no">Disabled</option>
                  </select>
                </label>
                <label>
                  <span>From email</span>
                  <input
                    value={email.fromEmail}
                    placeholder="outreach@yourdomain.com"
                    onChange={(event) =>
                      setEmail({ fromEmail: event.target.value })
                    }
                  />
                </label>
                <label>
                  <span>From name</span>
                  <input
                    value={email.fromName}
                    placeholder="Nadia at SignalDesk"
                    onChange={(event) =>
                      setEmail({ fromName: event.target.value })
                    }
                  />
                </label>
                <label>
                  <span>Reply-to (optional)</span>
                  <input
                    value={email.replyTo}
                    onChange={(event) =>
                      setEmail({ replyTo: event.target.value })
                    }
                  />
                </label>
                <label>
                  <span>
                    Resend API key{" "}
                    {meta.hasApiKey ? (
                      <span className="settings-key-saved">Saved</span>
                    ) : null}
                  </span>
                  <input
                    type="password"
                    value={secrets.apiKey}
                    placeholder={
                      meta.hasApiKey
                        ? "•••••••• (saved — leave blank to keep)"
                        : "re_..."
                    }
                    onChange={(event) =>
                      setSecrets((current) => ({
                        ...current,
                        apiKey: event.target.value,
                      }))
                    }
                  />
                </label>
              </div>

              <div className="settings-webhook-test">
                <input
                  value={emailTestTo}
                  placeholder={
                    email.fromEmail
                      ? `Send test to (default ${email.fromEmail})`
                      : "Send test to…"
                  }
                  onChange={(event) => setEmailTestTo(event.target.value)}
                />
                <button
                  className="button button--secondary"
                  type="button"
                  disabled={emailTesting}
                  onClick={() => void handleTestEmail()}
                >
                  <Send size={15} />{" "}
                  {emailTesting ? "Sending…" : "Send test email"}
                </button>
                {emailTestResult && (
                  <p className="muted-copy" role="status">
                    {emailTestResult}
                  </p>
                )}
              </div>
            </article>
          )}

          {tab === "webhooks" && (
            <article className="panel settings-section">
              <div className="settings-section__header">
                <span>
                  <Webhook size={18} />
                </span>
                <div>
                  <h2>Webhook security</h2>
                  <p>
                    Verify inbound and delivery webhooks. Secrets are stored
                    write-only.
                  </p>
                </div>
              </div>

              <div className="webhook-endpoints">
                <div>
                  <span>Inbound lead webhook</span>
                  <code>{origin}/api/webhooks/leads</code>
                </div>
                <div>
                  <span>Resend delivery webhook</span>
                  <code>{origin}/api/webhooks/resend</code>
                </div>
              </div>

              <div className="settings-field-grid">
                <label>
                  <span>Inbound signature (HMAC)</span>
                  <select
                    value={webhooks.inboundSignatureEnabled ? "yes" : "no"}
                    onChange={(event) =>
                      setWebhooks({
                        inboundSignatureEnabled: event.target.value === "yes",
                      })
                    }
                  >
                    <option value="yes">Required</option>
                    <option value="no">Not required</option>
                  </select>
                </label>
                <label>
                  <span>
                    Inbound signing secret{" "}
                    {meta.hasInboundSecret ? "(saved — leave blank to keep)" : ""}
                  </span>
                  <input
                    type="password"
                    value={secrets.inboundSecret}
                    placeholder={
                      meta.hasInboundSecret ? "••••••••" : "whsec_..."
                    }
                    onChange={(event) =>
                      setSecrets((current) => ({
                        ...current,
                        inboundSecret: event.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  <span>Resend signature (Svix)</span>
                  <select
                    value={webhooks.resendSignatureEnabled ? "yes" : "no"}
                    onChange={(event) =>
                      setWebhooks({
                        resendSignatureEnabled: event.target.value === "yes",
                      })
                    }
                  >
                    <option value="yes">Required</option>
                    <option value="no">Not required</option>
                  </select>
                </label>
                <label>
                  <span>
                    Resend webhook secret{" "}
                    {meta.hasResendSecret ? "(saved — leave blank to keep)" : ""}
                  </span>
                  <input
                    type="password"
                    value={secrets.resendSecret}
                    placeholder={meta.hasResendSecret ? "••••••••" : "whsec_..."}
                    onChange={(event) =>
                      setSecrets((current) => ({
                        ...current,
                        resendSecret: event.target.value,
                      }))
                    }
                  />
                </label>
              </div>

              <div className="settings-webhook-test">
                <button
                  className="button button--secondary"
                  type="button"
                  disabled={testing}
                  onClick={() => void handleTestWebhook()}
                >
                  <Send size={15} />{" "}
                  {testing ? "Sending…" : "Send test webhook"}
                </button>
                {testResult && (
                  <p className="muted-copy" role="status">
                    {testResult}
                  </p>
                )}
              </div>
            </article>
          )}

          {tab === "system" && (
            <article className="panel settings-section">
              <div className="settings-section__header">
                <span>
                  <Server size={18} />
                </span>
                <div>
                  <h2>System status</h2>
                  <p>Live provider and infrastructure health.</p>
                </div>
              </div>
              {health ? (
                <div className="system-status-list">
                  {health.providers.map((provider) => (
                    <div className="system-status-row" key={provider.name}>
                      <div>
                        <strong>{provider.name}</strong>
                        <small>
                          {provider.mode === "production"
                            ? "Production"
                            : "Demo"}
                          {provider.credentialsPresent
                            ? " · credentials set"
                            : " · no credentials"}
                        </small>
                      </div>
                      <span
                        className={`system-status-pill system-status-pill--${
                          provider.mode === "production" ? "ok" : "off"
                        }`}
                      >
                        {provider.mode === "production" ? "Active" : "Demo"}
                      </span>
                    </div>
                  ))}
                  {[
                    {
                      label: "Database",
                      detail: "PostgreSQL / Drizzle",
                      ok: health.infrastructure.database,
                      on: "Connected",
                      off: "In-memory",
                    },
                    {
                      label: "Redis",
                      detail: "Idempotency & rate limit",
                      ok: health.infrastructure.redis,
                      on: "Connected",
                      off: "In-memory",
                    },
                    {
                      label: "Inngest",
                      detail: "Durable workflow",
                      ok: health.infrastructure.inngest,
                      on: "Configured",
                      off: "Disabled",
                    },
                  ].map((row) => (
                    <div className="system-status-row" key={row.label}>
                      <div>
                        <strong>{row.label}</strong>
                        <small>{row.detail}</small>
                      </div>
                      <span
                        className={`system-status-pill system-status-pill--${
                          row.ok ? "ok" : "off"
                        }`}
                      >
                        {row.ok ? row.on : row.off}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="muted-copy">Loading system status…</p>
              )}
            </article>
          )}

          <button
            className="button button--primary settings-save"
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
          >
            <Save size={15} /> {saving ? "Saving…" : "Save settings"}
          </button>
      </div>
    </div>
  );
}
