export const userRoles = ["USER", "TECHNICIAN"] as const;

export type UserRole = (typeof userRoles)[number];

export interface AuthenticatedUser {
  id: string;
  name: string;
  username: string;
  role: UserRole;
}

export interface LoginInput {
  username: string;
  password: string;
}

export interface CreateUserInput extends LoginInput {
  name: string;
  role: UserRole;
}

export interface RegisterUserInput extends LoginInput {
  name: string;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
  };
}

export const sessionCookieName = "betterticket_session";
export const sessionMaxAgeSeconds = 24 * 60 * 60;

export const loginBodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["username", "password"],
  properties: {
    username: { type: "string", minLength: 1, maxLength: 100, pattern: "\\S" },
    password: { type: "string", minLength: 12, maxLength: 128 }
  }
} as const;

export const registrationBodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["name", "username", "password"],
  properties: {
    name: { type: "string", minLength: 1, maxLength: 160, pattern: "\\S" },
    username: {
      type: "string",
      minLength: 1,
      maxLength: 100,
      pattern: "^[\\s]*[A-Za-z0-9._-]+[\\s]*$"
    },
    password: { type: "string", minLength: 12, maxLength: 128 }
  }
} as const;

export const authenticatedUserResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "name", "username", "role"],
  properties: {
    id: { type: "string", format: "uuid" },
    name: { type: "string" },
    username: { type: "string" },
    role: { type: "string", enum: userRoles }
  }
} as const;

export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}
