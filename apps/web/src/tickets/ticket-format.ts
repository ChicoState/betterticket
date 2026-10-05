const statusLabels: Record<string, string> = {
  OPEN: "Open"
};

const createdAtFormat = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short"
});

export function formatStatus(status: string): string {
  return statusLabels[status] ?? status;
}

export function formatCreatedAt(createdAt: string): string {
  const date = new Date(createdAt);

  return Number.isNaN(date.getTime()) ? createdAt : createdAtFormat.format(date);
}
