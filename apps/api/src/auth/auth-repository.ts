import type { AuthenticatedUser, CreateUserInput, LoginInput } from "./auth-contract.js";

export interface CreatedSession {
  token: string;
  user: AuthenticatedUser;
}

export interface AuthRepository {
  createSession(input: LoginInput): Promise<CreatedSession | null>;
  findUserBySession(token: string): Promise<AuthenticatedUser | null>;
  deleteSession(token: string): Promise<void>;
  createUser(input: CreateUserInput): Promise<AuthenticatedUser | null>;
}
