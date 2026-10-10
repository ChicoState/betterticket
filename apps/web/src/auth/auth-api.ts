export interface AuthenticatedUser {
  id: string;
  name: string;
  username: string;
  role: "USER" | "TECHNICIAN";
}

export interface LoginInput {
  username: string;
  password: string;
}

export interface RegistrationInput extends LoginInput {
  name: string;
}

export class AuthApiError extends Error {}

function isAuthenticatedUser(value: unknown): value is AuthenticatedUser {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const user = value as Record<string, unknown>;
  return (
    typeof user.id === "string" &&
    typeof user.name === "string" &&
    typeof user.username === "string" &&
    (user.role === "USER" || user.role === "TECHNICIAN")
  );
}

async function requestUser(
  path: string,
  input: RegistrationInput | LoginInput
): Promise<AuthenticatedUser> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input)
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new AuthApiError("Username or password is incorrect.");
    }
    if (response.status === 409) {
      throw new AuthApiError("That username is unavailable.");
    }
    if (response.status === 429) {
      throw new AuthApiError("Please wait a moment before trying again.");
    }
    throw new AuthApiError("We couldn't complete that request. Please try again.");
  }

  const body: unknown = await response.json();
  if (!isAuthenticatedUser(body)) {
    throw new AuthApiError("We couldn't complete that request. Please try again.");
  }

  return body;
}

export function login(input: LoginInput): Promise<AuthenticatedUser> {
  return requestUser("/api/sessions", input);
}

export function register(input: RegistrationInput): Promise<AuthenticatedUser> {
  return requestUser("/api/users", input);
}
