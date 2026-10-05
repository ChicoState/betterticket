export const roles = ["USER", "IT_MEMBER", "ADMIN"] as const;
export type Role = (typeof roles)[number];

export interface AuthUser {
  id: string;
  email: string;
  passwordHash: string;
  role: Role;
  mustChangePassword: boolean;
}

export interface SessionRecord {
  user: Omit<AuthUser, "passwordHash">;
  csrfToken: string;
}

export interface AuthRepository {
  findUserByEmail(email: string): Promise<AuthUser | null>;
  createUser(input: { email: string; passwordHash: string; role: Role }): Promise<AuthUser>;
  changePassword(userId: string, passwordHash: string): Promise<void>;
  createSession(input: {
    userId: string;
    tokenHash: string;
    csrfToken: string;
    expiresAt: Date;
  }): Promise<void>;
  findSession(tokenHash: string): Promise<SessionRecord | null>;
  deleteSession(tokenHash: string): Promise<void>;
}
