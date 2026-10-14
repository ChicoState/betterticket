import type { TicketStatus } from "./ticket-api.js";

const statusLabels: Record<TicketStatus, string> = {
  OPEN: "Open",
  UNDER_REVIEW: "Under review",
  IN_PROGRESS: "In progress",
  RESOLVED: "Resolved",
  COMPLETED: "Completed"
};

export const ticketProgress: readonly TicketStatus[] = [
  "OPEN",
  "UNDER_REVIEW",
  "IN_PROGRESS",
  "RESOLVED",
  "COMPLETED"
];

export type ProgressStageState = "complete" | "current" | "upcoming";

const createdAtFormat = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short"
});

export function formatStatus(status: TicketStatus): string {
  return statusLabels[status];
}

export function getProgressStageState(
  status: TicketStatus,
  stage: TicketStatus
): ProgressStageState {
  const currentStage = ticketProgress.indexOf(status);
  const stageIndex = ticketProgress.indexOf(stage);

  if (stageIndex < currentStage) {
    return "complete";
  }

  return stageIndex === currentStage ? "current" : "upcoming";
}

export function formatCreatedAt(createdAt: string): string {
  const date = new Date(createdAt);

  return Number.isNaN(date.getTime()) ? createdAt : createdAtFormat.format(date);
}
