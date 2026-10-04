import type { Lead, WorkflowStep } from "./types";

const completedWorkflow = (
  start: string,
  approved = false,
): WorkflowStep[] => [
  {
    id: "captured",
    title: "Lead captured",
    status: "SUCCEEDED",
    timestamp: start,
    durationMs: 42,
    detail: "Form data normalized and stored.",
  },
  {
    id: "researched",
    title: "Company researched",
    status: "SUCCEEDED",
    timestamp: start,
    durationMs: 4_820,
    detail: "Homepage, product, and pricing signals reviewed.",
  },
  {
    id: "scored",
    title: "ICP fit scored",
    status: "SUCCEEDED",
    timestamp: start,
    durationMs: 1_460,
    detail: "Fit rubric evaluated with evidence-backed signals.",
  },
  {
    id: "drafted",
    title: "Nurture draft created",
    status: "SUCCEEDED",
    timestamp: start,
    durationMs: 2_130,
    detail: "Contextual follow-up prepared for human review.",
  },
  {
    id: "approval",
    title: approved ? "Draft approved" : "Awaiting approval",
    status: approved ? "SUCCEEDED" : "RUNNING",
    timestamp: start,
    detail: approved
      ? "A sales owner approved this draft."
      : "A human review is required before delivery.",
  },
];

export const seedLeads: Lead[] = [
  {
    id: "lead-aurora",
    fullName: "Maya Chen",
    initials: "MC",
    workEmail: "maya@auroragrid.io",
    role: "VP of Operations",
    source: "Workflow audit guide",
    company: {
      name: "AuroraGrid",
      domain: "auroragrid.io",
      website: "https://auroragrid.io",
      industry: "Energy software",
      estimatedSize: "51–200 employees",
      businessModel: "B2B SaaS",
      location: "Singapore",
      summary:
        "AuroraGrid helps distributed energy operators monitor assets and coordinate field operations from one cloud workspace.",
      technologies: ["HubSpot", "React", "Segment", "AWS"],
    },
    qualification: {
      score: 92,
      tier: "HIGH_PRIORITY",
      reasoning:
        "Strong company fit, a visible multi-team operations problem, and a senior operator showing active interest in workflow automation.",
      criteria: {
        companyFit: 34,
        problemFit: 28,
        buyingSignal: 18,
        dataConfidence: 12,
      },
      riskFlags: [],
    },
    enrichment: {
      painPoints: [
        "Field updates appear fragmented across regional teams.",
        "Manual handoffs may delay incident resolution and reporting.",
        "Scaling asset operations increases coordination overhead.",
      ],
      evidence: [
        {
          id: "ev-a1",
          label: "Product page describes multi-region field coordination",
          url: "https://auroragrid.io/product",
          sourceType: "WEBSITE",
          confidence: "HIGH",
        },
        {
          id: "ev-a2",
          label: "Operational handoff friction inferred from product workflow",
          sourceType: "AI_INFERENCE",
          confidence: "MEDIUM",
        },
      ],
      confidence: "HIGH",
    },
    draft: {
      subject: "A faster handoff for AuroraGrid’s field teams",
      body: `Hi Maya,\n\nThanks for downloading our workflow audit guide. I noticed AuroraGrid coordinates distributed energy operations across multiple field teams—exactly where small handoff delays tend to compound.\n\nWe help operations leaders turn those cross-team updates into one accountable workflow, without forcing the field team into another heavy system. Based on your current setup, the incident-to-reporting handoff could be a useful first process to map.\n\nWould a short workflow teardown next week be useful? I can come prepared with a simple before-and-after map for AuroraGrid.\n\nBest,\nNadia`,
      status: "DRAFT",
      lastEditedAt: "2026-10-04T08:42:00.000Z",
    },
    workflow: completedWorkflow("2026-10-04T08:31:00.000Z"),
    status: "READY_FOR_REVIEW",
    createdAt: "2026-10-04T08:31:00.000Z",
    updatedAt: "2026-10-04T08:42:00.000Z",
    processingDurationMs: 8_452,
  },
  {
    id: "lead-northstar",
    fullName: "Rafi Pratama",
    initials: "RP",
    workEmail: "rafi@northstar-logistics.co",
    role: "Head of Digital Transformation",
    source: "Automation webinar",
    company: {
      name: "Northstar Logistics",
      domain: "northstar-logistics.co",
      website: "https://northstar-logistics.co",
      industry: "Logistics & supply chain",
      estimatedSize: "201–1,000 employees",
      businessModel: "B2B services",
      location: "Jakarta, Indonesia",
      summary:
        "Northstar Logistics manages regional freight, warehousing, and shipment visibility for growing consumer brands.",
      technologies: ["Salesforce", "WordPress", "Google Analytics"],
    },
    qualification: {
      score: 86,
      tier: "HIGH_PRIORITY",
      reasoning:
        "Large operations footprint and an explicit digital transformation role indicate both problem relevance and internal ownership.",
      criteria: {
        companyFit: 32,
        problemFit: 27,
        buyingSignal: 16,
        dataConfidence: 11,
      },
      riskFlags: ["Tech-stack data last verified 30+ days ago"],
    },
    enrichment: {
      painPoints: [
        "Shipment exceptions likely require manual escalation.",
        "Customer status updates span multiple operational systems.",
        "Regional reporting may depend on spreadsheet consolidation.",
      ],
      evidence: [
        {
          id: "ev-n1",
          label: "Company site highlights regional warehousing operations",
          url: "https://northstar-logistics.co/services",
          sourceType: "WEBSITE",
          confidence: "HIGH",
        },
        {
          id: "ev-n2",
          label: "Transformation role supplied on inbound form",
          sourceType: "FORM_INPUT",
          confidence: "HIGH",
        },
      ],
      confidence: "HIGH",
    },
    draft: {
      subject: "Reducing exception handoffs at Northstar",
      body: `Hi Rafi,\n\nThanks for joining the automation webinar. With Northstar coordinating freight and warehousing across the region, exception handoffs are often where response time gets lost.\n\nOur team helps operations groups connect intake, ownership, and customer updates in one lightweight workflow. I’d be happy to map one Northstar exception flow and show where automation could remove repetitive follow-up.\n\nWould a 20-minute working session be useful?\n\nBest,\nNadia`,
      status: "DRAFT",
      lastEditedAt: "2026-10-04T07:55:00.000Z",
    },
    workflow: completedWorkflow("2026-10-04T07:48:00.000Z"),
    status: "READY_FOR_REVIEW",
    createdAt: "2026-10-04T07:48:00.000Z",
    updatedAt: "2026-10-04T07:55:00.000Z",
    processingDurationMs: 11_203,
  },
  {
    id: "lead-aldera",
    fullName: "Sofia Martins",
    initials: "SM",
    workEmail: "sofia@alderastudio.com",
    role: "Managing Director",
    source: "Contact sales",
    company: {
      name: "Aldera Studio",
      domain: "alderastudio.com",
      website: "https://alderastudio.com",
      industry: "Digital agency",
      estimatedSize: "11–50 employees",
      businessModel: "B2B services",
      location: "Lisbon, Portugal",
      summary:
        "Aldera Studio designs and launches digital products for early-stage technology companies.",
      technologies: ["Webflow", "HubSpot", "Figma", "Notion"],
    },
    qualification: {
      score: 68,
      tier: "MEDIUM",
      reasoning:
        "Clear workflow relevance, though the smaller team and project-based revenue model may limit near-term expansion potential.",
      criteria: {
        companyFit: 24,
        problemFit: 23,
        buyingSignal: 12,
        dataConfidence: 9,
      },
      riskFlags: ["Team size is estimated"],
    },
    enrichment: {
      painPoints: [
        "Client intake may create repetitive project setup work.",
        "Project handoff quality varies as client volume grows.",
      ],
      evidence: [
        {
          id: "ev-al1",
          label: "Services page shows a multi-stage client delivery process",
          url: "https://alderastudio.com/services",
          sourceType: "WEBSITE",
          confidence: "HIGH",
        },
        {
          id: "ev-al2",
          label: "Team size estimated from public footprint",
          sourceType: "AI_INFERENCE",
          confidence: "LOW",
        },
      ],
      confidence: "MEDIUM",
    },
    draft: {
      subject: "A lighter client handoff for Aldera",
      body: `Hi Sofia,\n\nThanks for reaching out. Aldera’s end-to-end product work means every new engagement carries a lot of context from discovery into delivery.\n\nWe help service teams automate the repetitive setup around that handoff while keeping the client experience personal. A useful first step could be mapping the move from signed proposal to a delivery-ready workspace.\n\nOpen to comparing notes for 15 minutes?\n\nBest,\nNadia`,
      status: "APPROVED",
      lastEditedAt: "2026-10-03T15:22:00.000Z",
    },
    workflow: completedWorkflow("2026-10-03T14:58:00.000Z", true),
    status: "APPROVED",
    createdAt: "2026-10-03T14:58:00.000Z",
    updatedAt: "2026-10-03T15:22:00.000Z",
    processingDurationMs: 9_934,
  },
  {
    id: "lead-lumora",
    fullName: "David Okafor",
    initials: "DO",
    workEmail: "david@lumorahealth.org",
    role: "Programs Manager",
    source: "ROI calculator",
    company: {
      name: "Lumora Health Initiative",
      domain: "lumorahealth.org",
      website: "https://lumorahealth.org",
      industry: "Nonprofit healthcare",
      estimatedSize: "11–50 employees",
      businessModel: "Nonprofit",
      location: "Lagos, Nigeria",
      summary:
        "Lumora Health Initiative coordinates community health programs and education with local partners.",
      technologies: ["WordPress", "Mailchimp"],
    },
    qualification: {
      score: 31,
      tier: "DISQUALIFIED",
      reasoning:
        "The organization has a relevant coordination problem, but its nonprofit model falls outside the current commercial ICP.",
      criteria: {
        companyFit: 8,
        problemFit: 16,
        buyingSignal: 3,
        dataConfidence: 4,
      },
      riskFlags: ["Outside commercial ICP", "Limited public operating data"],
    },
    enrichment: {
      painPoints: ["Partner reporting may involve manual data collection."],
      evidence: [
        {
          id: "ev-l1",
          label: "About page identifies the organization as a nonprofit",
          url: "https://lumorahealth.org/about",
          sourceType: "WEBSITE",
          confidence: "HIGH",
        },
      ],
      confidence: "MEDIUM",
    },
    draft: {
      subject: "Thank you for exploring the ROI calculator",
      body: `Hi David,\n\nThanks for trying the ROI calculator. Based on Lumora’s nonprofit operating model, our current commercial program may not be the best fit.\n\nI’m still happy to share the workflow mapping worksheet if it would help your partner reporting process.\n\nBest,\nNadia`,
      status: "DRAFT",
      lastEditedAt: "2026-10-03T11:14:00.000Z",
    },
    workflow: completedWorkflow("2026-10-03T11:04:00.000Z"),
    status: "READY_FOR_REVIEW",
    createdAt: "2026-10-03T11:04:00.000Z",
    updatedAt: "2026-10-03T11:14:00.000Z",
    processingDurationMs: 7_210,
  },
  {
    id: "lead-meridian",
    fullName: "Elena Rossi",
    initials: "ER",
    workEmail: "elena@meridianops.ai",
    role: "Revenue Operations Lead",
    source: "Playbook download",
    company: {
      name: "MeridianOps",
      domain: "meridianops.ai",
      website: "https://meridianops.ai",
      industry: "Revenue intelligence",
      estimatedSize: "51–200 employees",
      businessModel: "B2B SaaS",
      location: "Milan, Italy",
      summary:
        "MeridianOps provides revenue forecasting and pipeline intelligence for B2B software teams.",
      technologies: ["Salesforce", "Next.js", "Intercom", "Snowflake"],
    },
    qualification: {
      score: 79,
      tier: "HIGH_PRIORITY",
      reasoning:
        "Excellent category fit and a senior RevOps owner, with moderate confidence because the latest site research was incomplete.",
      criteria: {
        companyFit: 31,
        problemFit: 24,
        buyingSignal: 15,
        dataConfidence: 9,
      },
      riskFlags: ["Pricing page could not be accessed"],
    },
    enrichment: {
      painPoints: [
        "Lead routing and account research may be split across tools.",
        "Fast-growing pipeline volume can reduce personalization quality.",
      ],
      evidence: [
        {
          id: "ev-m1",
          label: "Homepage positions the product for scaled revenue teams",
          url: "https://meridianops.ai",
          sourceType: "WEBSITE",
          confidence: "HIGH",
        },
      ],
      confidence: "MEDIUM",
    },
    draft: {
      subject: "Keeping MeridianOps’ inbound research fast—and specific",
      body: `Hi Elena,\n\nThanks for downloading the playbook. MeridianOps helps revenue teams see pipeline clearly, so I imagine the quality and speed of your own inbound follow-up gets held to a high standard too.\n\nWe automate the research-to-draft workflow while keeping every claim tied to a visible source. That can give RevOps a faster response without trading away message quality.\n\nWould it help if I shared a sample workflow using MeridianOps as the account?\n\nBest,\nNadia`,
      status: "SENT",
      lastEditedAt: "2026-10-02T16:35:00.000Z",
    },
    workflow: completedWorkflow("2026-10-02T16:19:00.000Z", true).map(
      (step) =>
        step.id === "approval"
          ? {
              ...step,
              title: "Email sent",
              detail: "Approved draft delivered by the connected email provider.",
            }
          : step,
    ),
    status: "SENT",
    createdAt: "2026-10-02T16:19:00.000Z",
    updatedAt: "2026-10-02T16:35:00.000Z",
    processingDurationMs: 10_482,
  },
  {
    id: "lead-banyan",
    fullName: "Anika Sharma",
    initials: "AS",
    workEmail: "anika@banyanretail.in",
    role: "Growth Manager",
    source: "Demo request",
    company: {
      name: "Banyan Retail",
      domain: "banyanretail.in",
      website: "https://banyanretail.in",
      industry: "Retail technology",
      estimatedSize: "51–200 employees",
      businessModel: "B2B SaaS",
      location: "Bengaluru, India",
      summary:
        "Banyan Retail builds commerce and inventory software for multi-location specialty retailers.",
      technologies: ["Unable to verify"],
    },
    qualification: {
      score: 0,
      tier: "UNASSESSED",
      reasoning:
        "The website research step timed out. The lead has been preserved and can be retried without losing form data.",
      criteria: {
        companyFit: 0,
        problemFit: 0,
        buyingSignal: 0,
        dataConfidence: 0,
      },
      riskFlags: ["Website research timed out"],
    },
    enrichment: {
      painPoints: [],
      evidence: [
        {
          id: "ev-b1",
          label: "Company and role supplied on inbound form",
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
      lastEditedAt: "2026-10-04T06:12:00.000Z",
    },
    workflow: [
      {
        id: "captured",
        title: "Lead captured",
        status: "SUCCEEDED",
        timestamp: "2026-10-04T06:12:00.000Z",
        durationMs: 38,
        detail: "Form data normalized and stored.",
      },
      {
        id: "researched",
        title: "Company research failed",
        status: "FAILED",
        timestamp: "2026-10-04T06:12:04.000Z",
        durationMs: 12_000,
        detail: "Website request timed out. Safe to retry this step.",
      },
      {
        id: "scored",
        title: "ICP fit scoring",
        status: "PENDING",
        detail: "Waiting for company research.",
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
    status: "FAILED",
    createdAt: "2026-10-04T06:12:00.000Z",
    updatedAt: "2026-10-04T06:12:16.000Z",
  },
];

