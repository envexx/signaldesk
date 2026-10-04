"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  Building2,
  Check,
  CircleUserRound,
  Globe2,
  LockKeyhole,
  Mail,
  ScanSearch,
  ShieldCheck,
} from "lucide-react";
import { useState, type FormEvent } from "react";

import { useApiStore } from "@/components/providers/api-store";
import type { NewLeadInput } from "@/lib/demo/types";

interface FormErrors {
  fullName?: string;
  workEmail?: string;
  companyWebsite?: string;
}

function validateForm(input: NewLeadInput): FormErrors {
  const errors: FormErrors = {};
  if (input.fullName.trim().length < 2) {
    errors.fullName = "Enter the contact’s full name.";
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.workEmail.trim())) {
    errors.workEmail = "Enter a valid work email.";
  }
  try {
    const normalized = /^https?:\/\//i.test(input.companyWebsite)
      ? input.companyWebsite
      : `https://${input.companyWebsite}`;
    const url = new URL(normalized);
    if (!url.hostname.includes(".")) throw new Error("invalid domain");
  } catch {
    errors.companyWebsite = "Enter a valid company website.";
  }
  return errors;
}

export function NewLeadForm() {
  const router = useRouter();
  const { createLead, processLead } = useApiStore();
  const [values, setValues] = useState<NewLeadInput>({
    fullName: "",
    workEmail: "",
    companyWebsite: "",
    role: "",
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const setField = (field: keyof NewLeadInput, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setSubmitError(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = validateForm(values);
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }

    setIsProcessing(true);
    setSubmitError(null);

    try {
      const id = await createLead(values);
      await processLead(id);
      router.push(`/leads/${id}`);
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "Could not start enrichment. Please try again.",
      );
      setIsProcessing(false);
    }
  };

  return (
    <div className="new-lead-page">
      <Link className="back-link" href="/leads">
        <ArrowLeft size={15} /> Back to pipeline
      </Link>

      <section className="new-lead-layout">
        <div className="new-lead-intro">
          <p className="eyebrow">New enrichment</p>
          <h1>Turn a form fill into a conversation.</h1>
          <p className="new-lead-intro__copy">
            Add the signal you already have. SignalDesk turns it into a company brief,
            an explainable ICP score, and an approval-ready nurture draft.
          </p>

          <ol className="process-preview">
            <li>
              <span><Globe2 size={18} /></span>
              <div>
                <strong>Research the company</strong>
                <p>Collect useful context with source and confidence labels.</p>
              </div>
            </li>
            <li>
              <span><Bot size={18} /></span>
              <div>
                <strong>Evaluate ICP fit</strong>
                <p>Score four criteria and make the reasoning visible.</p>
              </div>
            </li>
            <li>
              <span><Mail size={18} /></span>
              <div>
                <strong>Prepare the follow-up</strong>
                <p>Draft an inbound response that always pauses for approval.</p>
              </div>
            </li>
          </ol>

          <div className="trust-note">
            <ShieldCheck size={20} />
            <div>
              <strong>Human-approved by design</strong>
              <p>Enrichment runs on the SignalDesk backend and always pauses for approval. Demo mode never sends an email.</p>
            </div>
          </div>
        </div>

        <div className="form-card">
          <div className="form-card__header">
            <span className="form-card__icon"><ScanSearch size={20} /></span>
            <div>
              <h2>Lead details</h2>
              <p>Fields marked with * are required.</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} noValidate>
            <div className="field-group">
              <label htmlFor="fullName">Full name *</label>
              <div className={`input-shell ${errors.fullName ? "input-shell--error" : ""}`}>
                <CircleUserRound size={17} />
                <input
                  id="fullName"
                  name="fullName"
                  autoComplete="name"
                  placeholder="e.g. Maya Chen"
                  value={values.fullName}
                  onChange={(event) => setField("fullName", event.target.value)}
                  aria-describedby={errors.fullName ? "fullName-error" : undefined}
                />
              </div>
              {errors.fullName && <small className="field-error" id="fullName-error">{errors.fullName}</small>}
            </div>

            <div className="field-group">
              <label htmlFor="workEmail">Work email *</label>
              <div className={`input-shell ${errors.workEmail ? "input-shell--error" : ""}`}>
                <Mail size={17} />
                <input
                  id="workEmail"
                  name="workEmail"
                  type="email"
                  autoComplete="email"
                  placeholder="maya@company.com"
                  value={values.workEmail}
                  onChange={(event) => setField("workEmail", event.target.value)}
                  aria-describedby={errors.workEmail ? "workEmail-error" : "workEmail-help"}
                />
              </div>
              {errors.workEmail ? (
                <small className="field-error" id="workEmail-error">{errors.workEmail}</small>
              ) : (
                <small className="field-help" id="workEmail-help">Free-email domains are flagged for review, not rejected.</small>
              )}
            </div>

            <div className="field-group">
              <label htmlFor="companyWebsite">Company website *</label>
              <div className={`input-shell ${errors.companyWebsite ? "input-shell--error" : ""}`}>
                <Globe2 size={17} />
                <input
                  id="companyWebsite"
                  name="companyWebsite"
                  inputMode="url"
                  autoComplete="url"
                  placeholder="company.com"
                  value={values.companyWebsite}
                  onChange={(event) => setField("companyWebsite", event.target.value)}
                  aria-describedby={errors.companyWebsite ? "companyWebsite-error" : undefined}
                />
              </div>
              {errors.companyWebsite && <small className="field-error" id="companyWebsite-error">{errors.companyWebsite}</small>}
            </div>

            <div className="field-group">
              <div className="field-label-row">
                <label htmlFor="role">Role or title</label>
                <span>Optional</span>
              </div>
              <div className="input-shell">
                <Building2 size={17} />
                <input
                  id="role"
                  name="role"
                  autoComplete="organization-title"
                  placeholder="e.g. VP of Operations"
                  value={values.role}
                  onChange={(event) => setField("role", event.target.value)}
                />
              </div>
            </div>

            <div className="form-assurance">
              <LockKeyhole size={15} />
              <span>Leads are stored in the SignalDesk demo workspace.</span>
            </div>

            {submitError && (
              <p className="field-error" role="alert">
                {submitError}
              </p>
            )}

            <button className="button button--primary button--wide" type="submit" disabled={isProcessing}>
              {isProcessing ? (
                <>
                  <span className="spinner" aria-hidden="true" /> Running enrichment…
                </>
              ) : (
                <>
                  Start enrichment <ArrowRight size={17} />
                </>
              )}
            </button>
          </form>

          <div className="form-card__footer">
            <Check size={14} /> Human approval remains required before delivery.
          </div>
        </div>
      </section>
    </div>
  );
}
