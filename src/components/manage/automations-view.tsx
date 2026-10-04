"use client";

import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
  type NodeTypes,
} from "@xyflow/react";
import {
  Bot,
  CheckCircle2,
  CircleDot,
  Clock3,
  FileCheck2,
  Globe2,
  LockKeyhole,
  MailCheck,
  RefreshCw,
  ScanSearch,
  ShieldCheck,
  UserCheck,
  Webhook,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState, useSyncExternalStore } from "react";

type StageIcon =
  | "capture"
  | "validate"
  | "research"
  | "extract"
  | "score"
  | "draft"
  | "review"
  | "approve"
  | "send";

type StageTone = "trigger" | "system" | "intelligence" | "human" | "delivery";

type AutomationNodeData = {
  order: string;
  title: string;
  category: string;
  description: string;
  backendBehavior: string;
  owner: string;
  resumeRule: string;
  icon: StageIcon;
  tone: StageTone;
};

type AutomationNode = Node<AutomationNodeData, "automation">;

const iconMap: Record<StageIcon, LucideIcon> = {
  capture: Webhook,
  validate: ShieldCheck,
  research: Globe2,
  extract: ScanSearch,
  score: CircleDot,
  draft: Bot,
  review: Clock3,
  approve: UserCheck,
  send: MailCheck,
};

const stageDefinitions: Array<AutomationNodeData & { id: StageIcon }> = [
  {
    id: "capture",
    order: "01",
    title: "Lead captured",
    category: "Trigger",
    description: "A form or webhook creates the lead and initializes its workflow state.",
    backendBehavior: "Creates every workflow step, marks Captured successful, and stores the normalized lead identity.",
    owner: "Lead API",
    resumeRule: "This stage is never repeated during a normal retry.",
    icon: "capture",
    tone: "trigger",
  },
  {
    id: "validate",
    order: "02",
    title: "Validate input",
    category: "Deterministic",
    description: "Checks that contact and company data are sufficient for enrichment.",
    backendBehavior: "Requires a work email and company website before any provider is called.",
    owner: "Workflow engine",
    resumeRule: "A failed validation stops the run and can be retried from this stage.",
    icon: "validate",
    tone: "system",
  },
  {
    id: "research",
    order: "03",
    title: "Research company",
    category: "Provider task",
    description: "Collects source material from the company website.",
    backendBehavior: "Calls the configured research provider and requires the target website to be reachable.",
    owner: "Research provider",
    resumeRule: "Provider failures preserve prior results and resume at Research.",
    icon: "research",
    tone: "intelligence",
  },
  {
    id: "extract",
    order: "04",
    title: "Extract intelligence",
    category: "AI-assisted",
    description: "Builds structured company context with evidence and confidence labels.",
    backendBehavior: "Produces industry, size, business model, location, summary, pains, technologies, and evidence.",
    owner: "Intelligence provider",
    resumeRule: "Cached research is reused within the run; a retry starts at the first incomplete stage.",
    icon: "extract",
    tone: "intelligence",
  },
  {
    id: "score",
    order: "05",
    title: "Score ICP fit",
    category: "Deterministic",
    description: "Combines structured signals and risk flags into an explainable score.",
    backendBehavior: "Calculates a backend-owned 0–100 qualification score; a free email lowers confidence but does not auto-disqualify.",
    owner: "Scoring domain",
    resumeRule: "Scoring can be resumed without rerunning completed upstream stages.",
    icon: "score",
    tone: "system",
  },
  {
    id: "draft",
    order: "06",
    title: "Prepare draft",
    category: "AI-assisted",
    description: "Generates a personalized nurture email from the enriched lead context.",
    backendBehavior: "Requires a non-empty subject and body and increments the draft version when regenerated.",
    owner: "Intelligence provider",
    resumeRule: "An approved or sent draft is never overwritten by enrichment.",
    icon: "draft",
    tone: "intelligence",
  },
  {
    id: "review",
    order: "07",
    title: "Pause for review",
    category: "Control point",
    description: "Moves the lead to Ready for review and pauses external delivery.",
    backendBehavior: "The automated enrichment sequence ends here with the draft visible to a human reviewer.",
    owner: "Workflow engine",
    resumeRule: "Rejecting returns the draft to review; rewriting does not bypass approval.",
    icon: "review",
    tone: "system",
  },
  {
    id: "approve",
    order: "08",
    title: "Human approval",
    category: "Human gate",
    description: "A reviewer confirms the latest draft version before delivery.",
    backendBehavior: "Rejects stale versions, requires subject and body, and optionally performs best-effort CRM sync.",
    owner: "Authorized reviewer",
    resumeRule: "Approval is idempotent and is never inferred from an automated stage.",
    icon: "approve",
    tone: "human",
  },
  {
    id: "send",
    order: "09",
    title: "Deliver message",
    category: "Protected action",
    description: "Sends only an approved draft and records every delivery attempt.",
    backendBehavior: "Uses the email provider when enabled; demo mode records a clearly labelled simulated delivery.",
    owner: "Delivery service",
    resumeRule: "A sent lead is terminal and cannot be re-enriched.",
    icon: "send",
    tone: "delivery",
  },
];

const desktopPositions = [
  { x: 0, y: 30 },
  { x: 250, y: 30 },
  { x: 500, y: 30 },
  { x: 750, y: 30 },
  { x: 1000, y: 30 },
  { x: 1000, y: 300 },
  { x: 750, y: 300 },
  { x: 500, y: 300 },
  { x: 250, y: 300 },
];

function subscribeToCompactLayout(callback: () => void) {
  const query = window.matchMedia("(max-width: 720px)");
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

function getCompactLayoutSnapshot() {
  return window.matchMedia("(max-width: 720px)").matches;
}

function getServerCompactLayoutSnapshot() {
  return false;
}

function AutomationStageNode({ data, selected }: NodeProps<AutomationNode>) {
  const Icon = iconMap[data.icon];

  return (
    <div className={`automation-node automation-node--${data.tone} ${selected ? "automation-node--selected" : ""}`}>
      <Handle className="automation-handle" id="target-left" position={Position.Left} type="target" />
      <Handle className="automation-handle" id="target-right" position={Position.Right} type="target" />
      <Handle className="automation-handle" id="target-top" position={Position.Top} type="target" />
      <Handle className="automation-handle" id="target-bottom" position={Position.Bottom} type="target" />
      <Handle className="automation-handle" id="source-left" position={Position.Left} type="source" />
      <Handle className="automation-handle" id="source-right" position={Position.Right} type="source" />
      <Handle className="automation-handle" id="source-top" position={Position.Top} type="source" />
      <Handle className="automation-handle" id="source-bottom" position={Position.Bottom} type="source" />

      <div className="automation-node__topline">
        <span className="automation-node__icon"><Icon size={17} /></span>
        <span className="automation-node__order">{data.order}</span>
      </div>
      <strong>{data.title}</strong>
      <small>{data.category}</small>
    </div>
  );
}

const nodeTypes = { automation: AutomationStageNode } satisfies NodeTypes;

function buildNodes(compact: boolean, selectedId: string): AutomationNode[] {
  return stageDefinitions.map((stage, index) => ({
    id: stage.id,
    type: "automation",
    position: compact ? { x: 0, y: index * 142 } : desktopPositions[index],
    data: stage,
    selected: stage.id === selectedId,
    draggable: false,
    selectable: true,
    deletable: false,
    ariaLabel: `View ${stage.title} stage`,
  }));
}

function workflowEdge(
  source: StageIcon,
  target: StageIcon,
  sourceHandle: string,
  targetHandle: string,
): Edge {
  return {
    id: `${source}-${target}`,
    source,
    target,
    sourceHandle,
    targetHandle,
    type: "smoothstep",
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 16,
      height: 16,
      color: "#79958b",
    },
    style: { stroke: "#94afa5", strokeWidth: 2 },
    selectable: false,
    deletable: false,
  };
}

function buildEdges(compact: boolean): Edge[] {
  const forwardSource = compact ? "source-bottom" : "source-right";
  const forwardTarget = compact ? "target-top" : "target-left";
  const returnSource = compact ? "source-bottom" : "source-left";
  const returnTarget = compact ? "target-top" : "target-right";

  const edges = [
    workflowEdge("capture", "validate", forwardSource, forwardTarget),
    workflowEdge("validate", "research", forwardSource, forwardTarget),
    workflowEdge("research", "extract", forwardSource, forwardTarget),
    workflowEdge("extract", "score", forwardSource, forwardTarget),
    workflowEdge("score", "draft", "source-bottom", "target-top"),
    workflowEdge("draft", "review", returnSource, returnTarget),
    workflowEdge("review", "approve", returnSource, returnTarget),
    workflowEdge("approve", "send", returnSource, returnTarget),
  ];

  edges.push({
    id: "review-draft-rejection",
    source: "review",
    target: "draft",
    sourceHandle: compact ? "source-right" : "source-bottom",
    targetHandle: compact ? "target-right" : "target-bottom",
    type: "smoothstep",
    label: "reject / rewrite",
    labelStyle: { fill: "#8b6941", fontSize: 10, fontWeight: 700 },
    labelBgStyle: { fill: "#faf7ef", fillOpacity: 0.96 },
    labelBgPadding: [7, 4],
    labelBgBorderRadius: 6,
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 15,
      height: 15,
      color: "#b49362",
    },
    style: { stroke: "#b49362", strokeWidth: 1.5, strokeDasharray: "5 5" },
    selectable: false,
    deletable: false,
  });

  return edges;
}

export function AutomationsView() {
  const compact = useSyncExternalStore(
    subscribeToCompactLayout,
    getCompactLayoutSnapshot,
    getServerCompactLayoutSnapshot,
  );
  const [selectedId, setSelectedId] = useState<StageIcon>("review");
  const nodes = useMemo(() => buildNodes(compact, selectedId), [compact, selectedId]);
  const edges = useMemo(() => buildEdges(compact), [compact]);
  const selectedStage = stageDefinitions.find((stage) => stage.id === selectedId) ?? stageDefinitions[0];
  const SelectedIcon = iconMap[selectedStage.icon];

  return (
    <div className="manage-page automation-page">
      <section className="page-heading page-heading--split">
        <div>
          <p className="eyebrow">Backend workflow map</p>
          <h1>Automations</h1>
          <p>See exactly how SignalDesk turns an inbound lead into human-approved outreach.</p>
        </div>
        <span className="automation-readonly-badge"><LockKeyhole size={14} /> Read-only system flow</span>
      </section>

      <section className="manage-metric-grid manage-metric-grid--four" aria-label="Workflow architecture summary">
        <article className="manage-metric-card">
          <span><Workflow size={17} /></span>
          <div><small>Backend stages</small><strong>9</strong></div>
          <em>One canonical lead lifecycle</em>
        </article>
        <article className="manage-metric-card">
          <span><Bot size={17} /></span>
          <div><small>Automated stages</small><strong>6</strong></div>
          <em>Validation through review</em>
        </article>
        <article className="manage-metric-card">
          <span><UserCheck size={17} /></span>
          <div><small>Human gates</small><strong>1</strong></div>
          <em>Approval is always explicit</em>
        </article>
        <article className="manage-metric-card">
          <span><RefreshCw size={17} /></span>
          <div><small>Durable retries</small><strong>2</strong></div>
          <em>One active run per lead</em>
        </article>
      </section>

      <section className="panel automation-flow-panel">
        <header className="automation-flow-panel__header">
          <div>
            <p className="panel-kicker">Inbound enrichment</p>
            <h2>Lead processing lifecycle</h2>
            <p>Click a stage to inspect its backend responsibility. The graph cannot be edited.</p>
          </div>
          <span className="health-summary"><span className="status-dot status-dot--live" /> Backend-defined</span>
        </header>

        <div className="automation-flow-layout">
          <div className="automation-flow-canvas" aria-label="Read-only lead automation diagram">
            <ReactFlow<AutomationNode, Edge>
              key={compact ? "compact-flow" : "desktop-flow"}
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              nodesDraggable={false}
              nodesConnectable={false}
              nodesFocusable
              edgesFocusable={false}
              edgesReconnectable={false}
              elementsSelectable
              deleteKeyCode={null}
              multiSelectionKeyCode={null}
              selectionKeyCode={null}
              zoomOnDoubleClick={false}
              onNodeClick={(_, node) => setSelectedId(node.id as StageIcon)}
              fitView
              fitViewOptions={{ padding: compact ? 0.14 : 0.09 }}
              minZoom={0.35}
              maxZoom={1.35}
              colorMode="light"
            >
              <Background color="#d8ddd5" gap={22} size={1} variant={BackgroundVariant.Dots} />
              <Controls showInteractive={false} position="bottom-left" />
            </ReactFlow>
            <div className="automation-flow-canvas__notice"><LockKeyhole size={13} /> Pan, zoom, and inspect only</div>
          </div>

          <aside className="automation-inspector" aria-live="polite">
            <div className={`automation-inspector__icon automation-inspector__icon--${selectedStage.tone}`}>
              <SelectedIcon size={20} />
            </div>
            <p className="panel-kicker">Stage {selectedStage.order} · {selectedStage.category}</p>
            <h3>{selectedStage.title}</h3>
            <p className="automation-inspector__description">{selectedStage.description}</p>

            <dl className="automation-inspector__details">
              <div>
                <dt>Backend behavior</dt>
                <dd>{selectedStage.backendBehavior}</dd>
              </div>
              <div>
                <dt>Responsible service</dt>
                <dd>{selectedStage.owner}</dd>
              </div>
              <div>
                <dt>Retry / safety rule</dt>
                <dd>{selectedStage.resumeRule}</dd>
              </div>
            </dl>

            <div className="automation-inspector__lock">
              <LockKeyhole size={15} />
              <div><strong>Configuration locked</strong><span>This view mirrors the backend contract and exposes no admin mutations.</span></div>
            </div>
          </aside>
        </div>

        <footer className="automation-flow-legend" aria-label="Workflow legend">
          <span><i className="automation-legend-dot automation-legend-dot--trigger" /> Trigger</span>
          <span><i className="automation-legend-dot automation-legend-dot--system" /> Deterministic</span>
          <span><i className="automation-legend-dot automation-legend-dot--intelligence" /> AI-assisted</span>
          <span><i className="automation-legend-dot automation-legend-dot--human" /> Human gate</span>
          <span><i className="automation-legend-dot automation-legend-dot--delivery" /> Delivery</span>
        </footer>
      </section>

      <section className="automation-rule-grid" aria-label="Runtime guarantees">
        <article className="panel automation-rule-card">
          <span><RefreshCw size={17} /></span>
          <div><strong>Resume-safe execution</strong><p>Successful stages are skipped; a retry resumes from the first failed or pending stage.</p></div>
        </article>
        <article className="panel automation-rule-card">
          <span><CheckCircle2 size={17} /></span>
          <div><strong>Idempotent outcomes</strong><p>Approved and sent leads are returned unchanged unless an explicit allowed action is requested.</p></div>
        </article>
        <article className="panel automation-rule-card">
          <span><FileCheck2 size={17} /></span>
          <div><strong>Human-in-the-loop</strong><p>The automation stops at review. Draft version conflicts are rejected before approval.</p></div>
        </article>
        <article className="panel automation-rule-card">
          <span><MailCheck size={17} /></span>
          <div><strong>Protected delivery</strong><p>Only approved drafts can be sent; demo mode writes a simulated outbox delivery.</p></div>
        </article>
      </section>
    </div>
  );
}
