"use client";

import { useRef, useState } from "react";

type Credentials = { name: string; email: string; password: string };

type AccountAuthProps = {
  googleConfigured: boolean;
  onGoogle: () => void;
  onCredentials: (mode: "login" | "signup", credentials: Credentials) => Promise<void>;
};

export function AccountAuth({ googleConfigured, onGoogle, onCredentials }: AccountAuthProps) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  function selectMode(nextMode: "login" | "signup") {
    setMode(nextMode);
    setError("");
    setNotice("");
    formRef.current?.reset();
  }

  async function submit(formData: FormData) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await onCredentials(mode, {
        name: String(formData.get("name") ?? ""),
        email: String(formData.get("email") ?? ""),
        password: String(formData.get("password") ?? ""),
      });
      if (mode === "signup") {
        formRef.current?.reset();
        setMode("login");
        setNotice("Account created. Log in with your new details.");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="account-card account-auth-card">
      <p className="eyebrow">Your Padma account</p>
      <h1>{mode === "login" ? "Welcome back." : "Begin your Padma story."}</h1>
      <p className="account-auth-intro">{mode === "login" ? "Already registered? Enter your account details below." : "New to Padma? Create your account first, then log in."}</p>
      <div className="account-auth-tabs" aria-label="Account access">
        <button type="button" aria-pressed={mode === "login"} onClick={() => selectMode("login")}>Log in</button>
        <button type="button" aria-pressed={mode === "signup"} onClick={() => selectMode("signup")}>Sign up</button>
      </div>

      <form ref={formRef} action={submit} className="account-auth-form">
        {mode === "signup" && <label>Name<input name="name" autoComplete="name" required /></label>}
        <label>Email<input name="email" type="email" autoComplete="email" required /></label>
        <label>Password<input name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={8} required /></label>
        {notice && <p className="account-form-success" role="status">{notice}</p>}
        {error && <p className="account-form-error" role="alert">{error}</p>}
        <button className="account-primary-action" type="submit" disabled={busy}>
          {busy ? "Please wait…" : mode === "login" ? "Log in to account" : "Create account"}
        </button>
      </form>

      <div className="account-auth-divider"><span>or</span></div>
      <button className="google-sign-in" type="button" onClick={onGoogle} disabled={!googleConfigured || busy}>
        <span aria-hidden="true">G</span>
        Continue with Google
      </button>
      {!googleConfigured && <p className="account-setup-note" role="status">Google sign-in is being configured.</p>}
    </section>
  );
}
