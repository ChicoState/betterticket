import { useState, type FormEvent } from "react";

import { AuthApiError, login, register } from "./auth-api.js";

interface AuthGatewayProps {
  onAuthenticated: () => void;
}

type Mode = "login" | "register";

export function AuthGateway({ onAuthenticated }: AuthGatewayProps) {
  const [mode, setMode] = useState<Mode>("login");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [username, setUsername] = useState("");

  function showLogin() {
    setMode("login");
    setError(null);
    setNotice(null);
  }

  function showRegistration() {
    setMode("register");
    setError(null);
    setNotice(null);
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setError(null);
    setNotice(null);
    setIsSubmitting(true);

    try {
      await login({
        username: String(formData.get("username") ?? ""),
        password: String(formData.get("password") ?? "")
      });
      onAuthenticated();
    } catch (cause) {
      setError(cause instanceof AuthApiError ? cause.message : "We couldn't sign you in.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRegistration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const password = String(formData.get("password") ?? "");
    const confirmation = String(formData.get("passwordConfirmation") ?? "");
    setError(null);
    setNotice(null);

    if (password !== confirmation) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    try {
      const user = await register({
        name: String(formData.get("name") ?? ""),
        username: String(formData.get("username") ?? ""),
        password
      });
      setUsername(user.username);
      setMode("login");
      setNotice("Account created. Sign in to continue.");
    } catch (cause) {
      setError(cause instanceof AuthApiError ? cause.message : "We couldn't create your account.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="intro" aria-labelledby="page-title">
        <p className="eyebrow">BetterTicket support</p>
        <h1 id="page-title">Get help your way.</h1>
        <p>Sign in to your account, create a regular user account, or continue without one.</p>
      </section>

      <section className="form-panel auth-panel" aria-label="Account access">
        <div className="auth-tabs" role="tablist" aria-label="Account options">
          <button
            aria-selected={mode === "login"}
            className={mode === "login" ? "auth-tab active" : "auth-tab"}
            onClick={showLogin}
            role="tab"
            type="button"
          >
            Sign in
          </button>
          <button
            aria-selected={mode === "register"}
            className={mode === "register" ? "auth-tab active" : "auth-tab"}
            onClick={showRegistration}
            role="tab"
            type="button"
          >
            Create an account
          </button>
        </div>

        {mode === "login" ? (
          <form key="login" onSubmit={handleLogin}>
            <fieldset disabled={isSubmitting}>
              <legend>Sign in</legend>
              <div className="field">
                <label htmlFor="login-username">Username</label>
                <input
                  autoComplete="username"
                  id="login-username"
                  maxLength={100}
                  name="username"
                  onChange={(event) => setUsername(event.target.value)}
                  required
                  value={username}
                />
              </div>
              <div className="field">
                <label htmlFor="login-password">Password</label>
                <input
                  autoComplete="current-password"
                  id="login-password"
                  maxLength={128}
                  minLength={1}
                  name="password"
                  required
                  type="password"
                />
              </div>
              <button className="submit-button" type="submit">
                {isSubmitting ? "Signing in…" : "Sign in"}
              </button>
            </fieldset>
          </form>
        ) : (
          <form key="registration" onSubmit={handleRegistration}>
            <fieldset disabled={isSubmitting}>
              <legend>Create a regular user account</legend>
              <div className="field">
                <label htmlFor="registration-name">Name</label>
                <input
                  autoComplete="name"
                  id="registration-name"
                  maxLength={160}
                  name="name"
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="registration-username">Username</label>
                <input
                  autoComplete="username"
                  id="registration-username"
                  maxLength={100}
                  name="username"
                  pattern="[A-Za-z0-9._-]+"
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="registration-password">Password</label>
                <input
                  autoComplete="new-password"
                  id="registration-password"
                  maxLength={128}
                  minLength={1}
                  name="password"
                  required
                  type="password"
                />
              </div>
              <div className="field">
                <label htmlFor="registration-password-confirmation">Confirm password</label>
                <input
                  autoComplete="new-password"
                  id="registration-password-confirmation"
                  maxLength={128}
                  minLength={1}
                  name="passwordConfirmation"
                  required
                  type="password"
                />
              </div>
              <button className="submit-button" type="submit">
                {isSubmitting ? "Creating account…" : "Create account"}
              </button>
            </fieldset>
          </form>
        )}

        <p className="auth-anonymous">
          Prefer not to sign in? <a href="/tickets">Continue anonymously</a>
        </p>
        <div aria-live="polite">
          {notice ? <p className="success-message">{notice}</p> : null}
          {error ? (
            <p className="error-message" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </section>
    </main>
  );
}
