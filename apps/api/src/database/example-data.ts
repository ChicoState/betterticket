import { argon2id, hash } from "argon2";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import type { TicketStatus } from "../tickets/ticket-contract.js";
import {
  notificationSettings,
  notifications,
  replyEndorsements,
  sessions,
  ticketReplies,
  tickets,
  users
} from "./schema.js";

// Shared by every example account. Example data is for local testing only.
export const examplePassword = "password";

export const exampleUsers = [
  { name: "Alice Student", username: "alice", role: "USER" },
  { name: "Bob Faculty", username: "bob", role: "USER" },
  { name: "Terry Technician", username: "terry", role: "TECHNICIAN" },
  { name: "Tina Technician", username: "tina", role: "TECHNICIAN" }
] as const;

type ExampleUsername = (typeof exampleUsers)[number]["username"];

// A string is a discussion comment; an object is a suggested solution.
type ExampleReply =
  | string
  | {
      solution: string;
      endorsedBy?: Array<{ technician: ExampleUsername; notes?: string }>;
    };

interface ExampleTicket {
  title: string;
  description: string;
  setup: string;
  additionalInformation?: string;
  creator?: ExampleUsername;
  isAnonymous?: boolean;
  technician?: ExampleUsername;
  statusHistory: TicketStatus[];
  replies?: ExampleReply[];
  daysAgo: number;
}

const exampleTickets: ExampleTicket[] = [
  {
    title: "Wi-Fi drops in the library",
    description: "My laptop disconnects from campus Wi-Fi every few minutes on the second floor.",
    setup: "Windows 11 laptop, Meriam Library 2nd floor",
    creator: "alice",
    statusHistory: ["OPEN"],
    daysAgo: 1
  },
  {
    title: "Projector not displaying in OCNL 241",
    description: "The classroom projector shows 'No signal' when connected over HDMI.",
    setup: "MacBook Pro with USB-C to HDMI adapter",
    additionalInformation: "Class starts at 9am on Mondays and Wednesdays.",
    creator: "bob",
    technician: "terry",
    statusHistory: ["OPEN", "UNDER_REVIEW"],
    replies: ["Does the projector work with the podium PC?", "Yes, only my laptop fails."],
    daysAgo: 3
  },
  {
    title: "Cannot access shared drive",
    description: "Mapping the department shared drive fails with an access denied error.",
    setup: "Department office desktop",
    creator: "alice",
    technician: "tina",
    statusHistory: ["OPEN", "UNDER_REVIEW", "IN_PROGRESS"],
    replies: [
      "We are reviewing the group permissions on that share.",
      {
        solution: "Sign out and back in so your new group membership applies, then map the drive.",
        endorsedBy: [
          { technician: "tina", notes: "Group changes only apply at sign-in on these desktops." },
          { technician: "terry" }
        ]
      },
      { solution: "Try mapping the drive while connected to the campus VPN." }
    ],
    daysAgo: 5
  },
  {
    title: "Printer jams on every job",
    description: "The lab printer jams on the first page of every print job.",
    setup: "Lab printer near room 110",
    isAnonymous: true,
    creator: "bob",
    technician: "terry",
    statusHistory: ["OPEN", "UNDER_REVIEW", "IN_PROGRESS", "RESOLVED"],
    replies: [
      "Replaced the feed rollers; please confirm it prints now.",
      {
        solution: "Fan the paper before loading it; the humid lab makes sheets stick.",
        endorsedBy: [{ technician: "terry", notes: "Worth doing even with the new rollers." }]
      }
    ],
    daysAgo: 8
  },
  {
    title: "Email password reset",
    description: "I need help resetting my campus email password.",
    setup: "Webmail in Firefox",
    creator: "alice",
    technician: "tina",
    statusHistory: ["OPEN", "UNDER_REVIEW", "IN_PROGRESS", "RESOLVED", "COMPLETED"],
    daysAgo: 14
  },
  {
    title: "Monitor flickers",
    description: "The second monitor flickers when the computer wakes from sleep.",
    setup: "Dell desktop with two monitors",
    statusHistory: ["OPEN"],
    daysAgo: 2
  }
];

const dayMilliseconds = 24 * 60 * 60 * 1_000;

export class ExampleDataConflictError extends Error {}

export async function loadExampleData(
  database: NodePgDatabase,
  options: { reset?: boolean } = {}
): Promise<void> {
  const passwordHash = await hash(examplePassword, { type: argon2id });

  await database.transaction(async (transaction) => {
    if (options.reset) {
      await transaction.delete(notifications);
      await transaction.delete(ticketReplies);
      await transaction.delete(tickets);
      await transaction.delete(sessions);
      await transaction.delete(users);
    } else {
      const [existingUser] = await transaction.select({ id: users.id }).from(users).limit(1);
      const [existingTicket] = await transaction.select({ id: tickets.id }).from(tickets).limit(1);
      if (existingUser || existingTicket) {
        throw new ExampleDataConflictError(
          "The database already contains data; rerun with --reset to replace it"
        );
      }
    }

    const insertedUsers = await transaction
      .insert(users)
      .values(exampleUsers.map((user) => ({ ...user, passwordHash })))
      .returning();
    const userIds = new Map(insertedUsers.map((user) => [user.username, user.id]));
    const userId = (username: ExampleUsername | undefined) =>
      username ? userIds.get(username) : undefined;

    const aliceId = userId("alice");
    if (aliceId) {
      // example.com is reserved for documentation, so no real mailbox receives these.
      await transaction.insert(notificationSettings).values({
        userId: aliceId,
        email: "alice@example.com",
        emailEnabled: true,
        emailStatuses: ["IN_PROGRESS", "RESOLVED"]
      });
    }

    const now = Date.now();
    for (const example of exampleTickets) {
      const createdAt = new Date(now - example.daysAgo * dayMilliseconds);
      const status = example.statusHistory.at(-1) ?? "OPEN";
      const [ticket] = await transaction
        .insert(tickets)
        .values({
          title: example.title,
          description: example.description,
          setup: example.setup,
          additionalInformation: example.additionalInformation,
          status,
          creatorUserId: userId(example.creator),
          isAnonymous: example.isAnonymous ?? false,
          assignedTechnicianId: userId(example.technician),
          createdAt,
          updatedAt: new Date(createdAt.getTime() + example.statusHistory.length * 60_000)
        })
        .returning();

      if (!ticket) {
        throw new Error("Ticket insert did not return a row");
      }

      for (const [index, reply] of (example.replies ?? []).entries()) {
        const replyCreatedAt = new Date(createdAt.getTime() + (index + 1) * 30_000);
        const [inserted] = await transaction
          .insert(ticketReplies)
          .values({
            ticketId: ticket.id,
            kind: typeof reply === "string" ? "COMMENT" : "SOLUTION",
            body: typeof reply === "string" ? reply : reply.solution,
            createdAt: replyCreatedAt
          })
          .returning();

        const endorsedBy = typeof reply === "string" ? [] : (reply.endorsedBy ?? []);
        if (inserted && endorsedBy.length > 0) {
          await transaction.insert(replyEndorsements).values(
            endorsedBy.map((endorsement, endorsementIndex) => {
              const endorsedAt = new Date(
                replyCreatedAt.getTime() + (endorsementIndex + 1) * 10_000
              );
              return {
                replyId: inserted.id,
                technicianId: userIds.get(endorsement.technician)!,
                notes: endorsement.notes ?? null,
                createdAt: endorsedAt,
                updatedAt: endorsedAt
              };
            })
          );
        }
      }

      const ownerId = ticket.creatorUserId;
      if (ownerId && example.statusHistory.length > 1) {
        await transaction.insert(notifications).values(
          example.statusHistory.slice(1).map((newStatus, index) => ({
            userId: ownerId,
            ticketId: ticket.id,
            previousStatus: example.statusHistory[index] ?? "OPEN",
            newStatus,
            createdAt: new Date(createdAt.getTime() + (index + 1) * 60_000),
            // Leave only the latest change unread so both states are visible.
            readAt:
              index < example.statusHistory.length - 2
                ? new Date(createdAt.getTime() + (index + 1) * 60_000)
                : null
          }))
        );
      }
    }
  });
}
