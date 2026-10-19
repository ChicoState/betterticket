import type { TicketVisibility } from "./ticket-contract.js";
import type { TicketViewer } from "./ticket-repository.js";

export interface TicketAccessRecord {
  visibility: TicketVisibility;
  creatorUserId: string | null;
}

export function canAccessTicket(ticket: TicketAccessRecord, viewer: TicketViewer | null): boolean {
  switch (ticket.visibility) {
    case "PUBLIC":
      return true;
    case "AUTHENTICATED":
      return viewer !== null;
    case "PRIVATE":
      return (
        viewer !== null && (viewer.role === "TECHNICIAN" || ticket.creatorUserId === viewer.id)
      );
    default:
      return false;
  }
}
