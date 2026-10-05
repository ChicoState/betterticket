export interface CreateTicketInput {
  title: string;
  description: string;
  setup: string;
  additionalInformation?: string;
}

export interface CreatedTicket {
  id: string;
}

export interface CurrentUser {
  id: string;
  email: string;
  role: "USER" | "IT_MEMBER" | "ADMIN";
}

export interface Comment {
  id: string;
  parentCommentId: string | null;
  body: string;
  isSpotlighted: boolean;
  deletedAt: string | null;
  helpfulCount: number;
  createdAt: string;
}

export interface TicketDetail extends CreatedTicket {
  title: string;
  description: string;
  setup: string;
  status: "OPEN" | "RESOLVED";
  solutionCommentId: string | null;
  comments: Comment[];
}

function isCreatedTicket(value: unknown): value is CreatedTicket {
  return (
    typeof value === "object" && value !== null && "id" in value && typeof value.id === "string"
  );
}

async function request(path: string, csrfToken?: string, options: RequestInit = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
      ...options.headers
    }
  });
  if (!response.ok) throw new Error("Request failed");
  return response;
}

export async function login(
  email: string,
  password: string
): Promise<{ user: CurrentUser; csrfToken: string }> {
  const response = await request("/api/auth/login", undefined, {
    method: "POST",
    body: JSON.stringify({ email, password })
  });
  return response.json() as Promise<{ user: CurrentUser; csrfToken: string }>;
}

export async function createTicket(
  input: CreateTicketInput,
  csrfToken: string
): Promise<CreatedTicket> {
  const response = await request("/api/tickets", csrfToken, {
    method: "POST",
    body: JSON.stringify(input)
  });

  const body: unknown = await response.json();
  if (!isCreatedTicket(body)) {
    throw new Error("Ticket creation returned an invalid response");
  }

  return body;
}

export async function getTicket(id: string): Promise<TicketDetail> {
  return (await request(`/api/tickets/${id}`)).json() as Promise<TicketDetail>;
}

export async function createComment(
  ticketId: string,
  body: string,
  parentCommentId: string | undefined,
  csrfToken: string
): Promise<void> {
  await request(`/api/tickets/${ticketId}/comments`, csrfToken, {
    method: "POST",
    body: JSON.stringify({ body, ...(parentCommentId ? { parentCommentId } : {}) })
  });
}

export async function toggleHelpful(commentId: string, csrfToken: string): Promise<void> {
  await request(`/api/comments/${commentId}/helpful`, csrfToken, { method: "PUT" });
}

export async function setSolution(
  ticketId: string,
  commentId: string,
  csrfToken: string
): Promise<void> {
  await request(`/api/tickets/${ticketId}/solution/${commentId}`, csrfToken, { method: "PUT" });
}

export async function setSpotlight(
  commentId: string,
  isSpotlighted: boolean,
  csrfToken: string
): Promise<void> {
  await request(`/api/comments/${commentId}/spotlight`, csrfToken, {
    method: "PUT",
    body: JSON.stringify({ isSpotlighted })
  });
}
