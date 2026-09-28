export interface CreateTicketInput {
  title: string;
  description: string;
  setup: string;
  additionalInformation?: string;
}

export interface CreatedTicket {
  id: string;
}

function isCreatedTicket(value: unknown): value is CreatedTicket {
  return (
    typeof value === "object" && value !== null && "id" in value && typeof value.id === "string"
  );
}

export async function createTicket(input: CreateTicketInput): Promise<CreatedTicket> {
  const response = await fetch("/api/tickets", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input)
  });

  if (!response.ok) {
    throw new Error("Ticket creation failed");
  }

  const body: unknown = await response.json();
  if (!isCreatedTicket(body)) {
    throw new Error("Ticket creation returned an invalid response");
  }

  return body;
}
