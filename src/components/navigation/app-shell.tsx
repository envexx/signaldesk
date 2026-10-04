"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Bell,
  ChevronDown,
  LayoutDashboard,
  Menu,
  Plus,
  RotateCcw,
  ScanSearch,
  Send,
  Settings,
  Users,
  Workflow,
  X,
} from "lucide-react";
import { useState, type ReactNode } from "react";

import { useApiStore } from "@/components/providers/api-store";

const navItems = [
  { label: "Overview", href: "/", icon: LayoutDashboard },
  { label: "Leads", href: "/leads", icon: Users },
  { label: "New enrichment", href: "/leads/new", icon: ScanSearch },
];

const manageItems = [
  { label: "Automations", href: "/automations", icon: Workflow },
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
  { label: "Outbox", href: "/outbox", icon: Send },
  { label: "Settings", href: "/settings", icon: Settings },
];

const allNavItems = [...navItems, ...manageItems];

function SignalDeskMark() {
  return (
    <svg viewBox="0 0 32 32" role="presentation">
      <path
        fill="currentColor"
        d="M6 5h20v5H11v3h12a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H6v-5h15v-3H9a3 3 0 0 1-3-3V5Z"
      />
    </svg>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { resetDemo, dashboard } = useApiStore();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const activity = dashboard?.activityFeed ?? [];

  const activeHref = allNavItems.reduce<string | null>((bestMatch, item) => {
    const matches =
      item.href === "/"
        ? pathname === "/"
        : pathname === item.href || pathname.startsWith(`${item.href}/`);

    if (!matches) return bestMatch;
    return !bestMatch || item.href.length > bestMatch.length
      ? item.href
      : bestMatch;
  }, null);

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileOpen ? "sidebar--open" : ""}`}>
        <div className="brand-row">
          <Link className="brand" href="/" onClick={() => setMobileOpen(false)}>
            <span className="brand__mark" aria-hidden="true">
              <SignalDeskMark />
            </span>
            <span>SignalDesk</span>
          </Link>
          <button
            className="icon-button sidebar__close"
            type="button"
            aria-label="Close navigation"
            onClick={() => setMobileOpen(false)}
          >
            <X size={20} />
          </button>
        </div>

        <nav className="sidebar-nav" aria-label="Primary navigation">
          <span className="nav-label">Workspace</span>
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeHref === item.href;
            return (
              <Link
                key={item.href}
                className={`nav-item ${active ? "nav-item--active" : ""}`}
                href={item.href}
                aria-current={active ? "page" : undefined}
                onClick={() => setMobileOpen(false)}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </Link>
            );
          })}

          <span className="nav-label nav-label--spaced">Manage</span>
          {manageItems.map((item) => {
            const Icon = item.icon;
            const active = activeHref === item.href;
            return (
              <Link
                className={`nav-item ${active ? "nav-item--active" : ""}`}
                href={item.href}
                aria-current={active ? "page" : undefined}
                key={item.href}
                onClick={() => setMobileOpen(false)}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-card">
          <button type="button" onClick={() => void resetDemo()}>
            <RotateCcw size={14} /> Reload workspace
          </button>
        </div>

        <div className="user-card">
          <span className="avatar">NP</span>
          <span>
            <strong>Nadia Putri</strong>
            <small>Growth Operations</small>
          </span>
          <ChevronDown size={16} />
        </div>
      </aside>

      {mobileOpen && (
        <button
          className="sidebar-scrim"
          type="button"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <section className="app-main">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            type="button"
            aria-label="Open navigation"
            onClick={() => setMobileOpen(true)}
          >
            <Menu size={20} />
          </button>
          <div className="topbar__context">
            <span className="status-dot status-dot--live" />
            Live · auto-refresh
          </div>
          <div className="topbar__actions">
            <div className="notification-wrap">
              <button
                className="icon-button"
                type="button"
                aria-label="Notifications"
                aria-expanded={bellOpen}
                onClick={() => setBellOpen((open) => !open)}
              >
                <Bell size={18} />
                {activity.length > 0 && <span className="notification-dot" />}
              </button>
              {bellOpen && (
                <div className="notification-panel" role="menu">
                  <div className="notification-panel__header">Recent activity</div>
                  {activity.length === 0 ? (
                    <p className="muted-copy">No activity yet.</p>
                  ) : (
                    activity.slice(0, 6).map((event) => (
                      <Link
                        key={event.id}
                        className="notification-item"
                        href={event.leadId ? `/leads/${event.leadId}` : "/"}
                        onClick={() => setBellOpen(false)}
                      >
                        <strong>{event.message}</strong>
                        <small>{event.companyName ?? ""}</small>
                      </Link>
                    ))
                  )}
                </div>
              )}
            </div>
            <Link className="button button--dark button--compact" href="/leads/new">
              <Plus size={16} />
              <span>Enrich lead</span>
            </Link>
          </div>
        </header>
        <main className="page-container">{children}</main>
      </section>
    </div>
  );
}
