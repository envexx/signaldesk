import { AlertTriangle, Check, Clock3, LoaderCircle } from "lucide-react";
import type { CSSProperties } from "react";

import type { WorkflowStep } from "@/lib/demo/types";

function formatTime(timestamp?: string) {
  if (!timestamp) return "Not started";
  return new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(timestamp));
}

function durationLabel(duration?: number) {
  if (duration === undefined) return null;
  return duration < 1000 ? `${duration}ms` : `${(duration / 1000).toFixed(1)}s`;
}

export function WorkflowTimeline({ steps }: { steps: WorkflowStep[] }) {
  const timelineStyle = {
    "--workflow-columns": steps.length,
  } as CSSProperties;

  return (
    <div className="workflow-timeline" style={timelineStyle}>
      {steps.map((step, index) => {
        const Icon =
          step.status === "SUCCEEDED"
            ? Check
            : step.status === "FAILED"
              ? AlertTriangle
              : step.status === "RUNNING"
                ? LoaderCircle
                : Clock3;
        return (
          <div className={`workflow-step workflow-step--${step.status.toLowerCase()}`} key={step.id}>
            <div className="workflow-step__rail">
              <span><Icon size={15} /></span>
              {index < steps.length - 1 && <i />}
            </div>
            <div className="workflow-step__content">
              <div>
                <strong>{step.title}</strong>
                <small>{step.detail}</small>
              </div>
              <div className="workflow-step__meta">
                <time>{formatTime(step.timestamp)}</time>
                {durationLabel(step.durationMs) && <span>{durationLabel(step.durationMs)}</span>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
