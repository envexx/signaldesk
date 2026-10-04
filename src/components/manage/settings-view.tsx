"use client";

import {
  BellRing,
  Check,
  CheckCircle2,
  Database,
  KeyRound,
  Mail,
  Save,
  ServerCog,
  ShieldCheck,
  SlidersHorizontal,
  Webhook,
} from "lucide-react";
import { useState, type FormEvent } from "react";

interface PreferenceRowProps {
  title: string;
  description: string;
  enabled: boolean;
  onChange: () => void;
}

function PreferenceRow({ title, description, enabled, onChange }: PreferenceRowProps) {
  return (
    <div className="preference-row">
      <div><strong>{title}</strong><p>{description}</p></div>
      <button
        className={`toggle-switch ${enabled ? "toggle-switch--on" : ""}`}
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={`${enabled ? "Disable" : "Enable"} ${title}`}
        onClick={onChange}
      >
        <span />
      </button>
    </div>
  );
}

export function SettingsView() {
  const [workspaceName, setWorkspaceName] = useState("SignalDesk Growth");
  const [timezone, setTimezone] = useState("Asia/Jakarta");
  const [saved, setSaved] = useState(false);
  const [preferences, setPreferences] = useState({
    approvalRequired: true,
    evidenceLabels: true,
    autoDisqualify: false,
    rawContent: false,
    emailNotifications: true,
    failureNotifications: true,
  });

  const toggle = (key: keyof typeof preferences) => {
    setPreferences((current) => ({ ...current, [key]: !current[key] }));
    setSaved(false);
  };

  const saveSettings = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaved(true);
  };

  return (
    <div className="manage-page settings-page">
      <section className="page-heading page-heading--split">
        <div>
          <p className="eyebrow">Workspace configuration</p>
          <h1>Settings</h1>
          <p>Configure review policy, data handling, notifications, and integrations.</p>
        </div>
        <span className="settings-mode"><span className="status-dot status-dot--live" /> Demo environment</span>
      </section>

      {saved && (
        <div className="settings-saved" role="status">
          <Check size={15} /> Settings saved in this browser.
        </div>
      )}

      <form className="settings-layout" onSubmit={saveSettings}>
        <div className="settings-main">
          <section className="panel settings-section">
            <div className="settings-section__header">
              <span><SlidersHorizontal size={18} /></span>
              <div><h2>Workspace</h2><p>Basic information used throughout SignalDesk.</p></div>
            </div>
            <div className="settings-field-grid">
              <label>
                <span>Workspace name</span>
                <input value={workspaceName} onChange={(event) => { setWorkspaceName(event.target.value); setSaved(false); }} />
              </label>
              <label>
                <span>Timezone</span>
                <select value={timezone} onChange={(event) => { setTimezone(event.target.value); setSaved(false); }}>
                  <option value="Asia/Jakarta">Asia/Jakarta (UTC+7)</option>
                  <option value="Asia/Singapore">Asia/Singapore (UTC+8)</option>
                  <option value="Europe/London">Europe/London</option>
                  <option value="America/New_York">America/New_York</option>
                </select>
              </label>
            </div>
          </section>

          <section className="panel settings-section">
            <div className="settings-section__header">
              <span><ShieldCheck size={18} /></span>
              <div><h2>Enrichment policy</h2><p>Guardrails applied before a lead can move forward.</p></div>
            </div>
            <div className="preference-list">
              <PreferenceRow
                title="Require human approval"
                description="Every generated draft must be reviewed before delivery."
                enabled={preferences.approvalRequired}
                onChange={() => toggle("approvalRequired")}
              />
              <PreferenceRow
                title="Show evidence and inference labels"
                description="Keep sourced facts distinct from AI-assisted inference."
                enabled={preferences.evidenceLabels}
                onChange={() => toggle("evidenceLabels")}
              />
              <PreferenceRow
                title="Automatically disqualify low scores"
                description="Move leads below the threshold out of the review queue."
                enabled={preferences.autoDisqualify}
                onChange={() => toggle("autoDisqualify")}
              />
              <PreferenceRow
                title="Retain raw website content"
                description="Store original research content after structured extraction."
                enabled={preferences.rawContent}
                onChange={() => toggle("rawContent")}
              />
            </div>
          </section>

          <section className="panel settings-section">
            <div className="settings-section__header">
              <span><BellRing size={18} /></span>
              <div><h2>Notifications</h2><p>Choose which operational events need attention.</p></div>
            </div>
            <div className="preference-list">
              <PreferenceRow
                title="High-priority lead alerts"
                description="Notify the owner when an ICP score reaches 75 or higher."
                enabled={preferences.emailNotifications}
                onChange={() => toggle("emailNotifications")}
              />
              <PreferenceRow
                title="Workflow failure alerts"
                description="Notify the workspace when a retry requires manual action."
                enabled={preferences.failureNotifications}
                onChange={() => toggle("failureNotifications")}
              />
            </div>
          </section>

          <button className="button button--primary settings-save" type="submit">
            <Save size={16} /> Save changes
          </button>
        </div>

        <aside className="settings-sidebar">
          <section className="panel settings-section integrations-section">
            <div className="settings-section__header">
              <span><ServerCog size={18} /></span>
              <div><h2>Connections</h2><p>Current provider state.</p></div>
            </div>
            <div className="connection-list">
              {[
                ["Backend API", "Connected", Webhook, "connected"],
                ["Lead repository", "Demo store", Database, "demo"],
                ["Email delivery", "Disabled", Mail, "disabled"],
                ["Provider secrets", "Server only", KeyRound, "secure"],
              ].map(([name, status, Icon, state]) => {
                const ConnectionIcon = Icon as typeof Webhook;
                return (
                  <div className="connection-row" key={name as string}>
                    <span><ConnectionIcon size={16} /></span>
                    <div><strong>{name as string}</strong><small>{status as string}</small></div>
                    <i className={`connection-state connection-state--${state as string}`}>
                      {state === "connected" || state === "secure" ? <CheckCircle2 size={14} /> : null}
                    </i>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="settings-security-note">
            <ShieldCheck size={18} />
            <div><strong>Secrets stay server-side</strong><p>API credentials are never exposed to browser components.</p></div>
          </section>
        </aside>
      </form>
    </div>
  );
}

