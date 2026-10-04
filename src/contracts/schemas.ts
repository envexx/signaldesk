/**
 * Zod schemas for every external payload. These are the source of truth for
 * request validation and produce field-level errors in the API envelope.
 */

import { z } from "zod";

import { LEAD_STATUSES, TIERS } from "./lead";
import { normalizeEmail, normalizeWebsite } from "./normalize";

const NAME_MAX = 120;
const EMAIL_MAX = 254;

const fullNameSchema = z
  .string()
  .trim()
  .min(2, "Full name must be at least 2 characters")
  .max(NAME_MAX, "Full name is too long");

const emailSchema = z
  .string()
  .trim()
  .min(3, "Work email is required")
  .max(EMAIL_MAX, "Work email is too long")
  .refine((value) => z.email().safeParse(value).success, {
    message: "Enter a valid email address",
  })
  .transform((value) => normalizeEmail(value));

const websiteSchema = z
  .string()
  .trim()
  .min(3, "Company website is required")
  .max(255, "Company website is too long")
  .superRefine((value, ctx) => {
    if (!normalizeWebsite(value)) {
      ctx.addIssue({
        code: "custom",
        message: "Enter a valid website, e.g. acme.com",
      });
    }
  });

const optionalShortText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value.length ? value : undefined))
    .optional();

export const createLeadSchema = z.object({
  fullName: fullNameSchema,
  workEmail: emailSchema,
  companyWebsite: websiteSchema,
  companyName: optionalShortText(NAME_MAX),
  role: optionalShortText(NAME_MAX),
  source: optionalShortText(60),
});

export type CreateLeadPayload = z.infer<typeof createLeadSchema>;

/**
 * Inbound webhook accepts a slightly looser shape (alias for the website field
 * and an optional free-text note) so third-party forms can post directly.
 */
export const webhookLeadSchema = z
  .object({
    fullName: fullNameSchema,
    workEmail: emailSchema,
    companyWebsite: z.string().trim().max(255).optional(),
    website: z.string().trim().max(255).optional(),
    companyDomain: z.string().trim().max(255).optional(),
    companyName: optionalShortText(NAME_MAX),
    role: optionalShortText(NAME_MAX),
    source: optionalShortText(60),
    message: optionalShortText(2000),
  })
  .superRefine((value, ctx) => {
    const candidate =
      value.companyWebsite ?? value.website ?? value.companyDomain ?? "";
    if (!normalizeWebsite(candidate)) {
      ctx.addIssue({
        code: "custom",
        path: ["companyWebsite"],
        message: "Provide a valid company website or domain",
      });
    }
  });

export type WebhookLeadPayload = z.infer<typeof webhookLeadSchema>;

export const updateLeadSchema = z
  .object({
    fullName: fullNameSchema.optional(),
    workEmail: emailSchema.optional(),
    role: z
      .union([z.string().trim().max(NAME_MAX), z.null()])
      .optional(),
    source: optionalShortText(60),
    company: z
      .object({
        name: z.string().trim().min(1).max(NAME_MAX).optional(),
        industry: optionalShortText(NAME_MAX),
        estimatedSize: optionalShortText(NAME_MAX),
        businessModel: optionalShortText(NAME_MAX),
      })
      .optional(),
    draft: z
      .object({
        subject: z.string().trim().max(200).optional(),
        body: z.string().trim().max(6000).optional(),
      })
      .optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Provide at least one field to update",
  });

export type UpdateLeadPayload = z.infer<typeof updateLeadSchema>;

export const approveLeadSchema = z.object({
  confirm: z.literal(true, {
    message: "Explicit confirmation is required to approve",
  }),
  subject: z.string().trim().min(1).max(200).optional(),
  body: z.string().trim().min(1).max(6000).optional(),
  version: z.number().int().min(0).optional(),
});

export type ApproveLeadPayload = z.infer<typeof approveLeadSchema>;

/** Optional body for process/retry. `force` re-runs succeeded stages. */
export const processLeadSchema = z
  .object({
    force: z.boolean().optional().default(false),
  })
  .optional();

export type ProcessLeadPayload = z.infer<typeof processLeadSchema>;

/**
 * Explicit confirmation is required before a real send is attempted. In demo
 * mode the send endpoint is disabled regardless of this flag.
 */
export const sendLeadSchema = z.object({
  confirm: z.literal(true, {
    message: "Explicit confirmation is required to send",
  }),
});

export type SendLeadPayload = z.infer<typeof sendLeadSchema>;

const uppercaseEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z
    .string()
    .trim()
    .transform((value) => value.toUpperCase())
    .pipe(z.enum(values));

export const leadListQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((value) => (value && value.length ? value : undefined)),
  tier: uppercaseEnum(TIERS).optional(),
  status: uppercaseEnum(LEAD_STATUSES).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export type LeadListQuery = z.infer<typeof leadListQuerySchema>;

const stringListSchema = z.array(z.string().trim().min(1).max(160)).max(40);

export const settingsSchema = z.object({
  targetProspect: z.object({
    industries: stringListSchema,
    companySizes: stringListSchema,
    regions: stringListSchema,
    roles: stringListSchema,
    painPoints: stringListSchema,
    buyingSignals: stringListSchema,
    disqualifiers: stringListSchema,
    notes: z.string().trim().max(2000),
  }),
  companyContext: z.object({
    companyName: z.string().trim().max(160),
    website: z.string().trim().max(255),
    valueProposition: z.string().trim().max(2000),
    offerings: stringListSchema,
    differentiators: stringListSchema,
    caseStudies: stringListSchema,
    tone: z.string().trim().max(300),
    callToAction: z.string().trim().max(300),
    signature: z.string().trim().max(300),
    notes: z.string().trim().max(2000),
  }),
  email: z.object({
    provider: z.enum(["demo", "resend"]),
    fromEmail: z.string().trim().max(255),
    fromName: z.string().trim().max(120),
    replyTo: z.string().trim().max(255),
    enabled: z.boolean(),
    apiKey: z.string().trim().max(400).optional(),
  }),
  webhooks: z.object({
    inboundSignatureEnabled: z.boolean(),
    resendSignatureEnabled: z.boolean(),
    inboundSecret: z.string().trim().max(400).optional(),
    resendSecret: z.string().trim().max(400).optional(),
  }),
});

export type SettingsPayload = z.infer<typeof settingsSchema>;
