import { useRef, useState } from "react";
import { registerWithEmail, requestPasswordReset, signInWithEmail, signInWithGoogle } from "../services/auth.js";
import { authErrorMessage, PASSWORD_RESET_MESSAGE, validateAuthForm } from "../services/authFlow.js";

const titles = { signin: "Sign in", register: "Create account", reset: "Reset password" };

export default function SignInScreen() {
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const inFlight = useRef(false);
  const emailInput = useRef(null);

  function changeMode(next) {
    if (inFlight.current) return;
    setMode(next);
    setPassword("");
    setConfirmation("");
    setError("");
    setMessage("");
    emailInput.current?.focus();
  }

  async function submit(event, google = false) {
    event?.preventDefault();
    if (inFlight.current) return;
    setError("");
    setMessage("");
    if (!google) {
      const validation = validateAuthForm(mode, { email, password, confirmation });
      if (validation) { setError(validation); return; }
    }
    inFlight.current = true;
    setBusy(true);
    try {
      if (google) await signInWithGoogle();
      else if (mode === "register") {
        const result = await registerWithEmail(email, password);
        if (result.passwordError) { setError(result.passwordError); return; }
      } else if (mode === "reset") {
        await requestPasswordReset(email);
        setMessage(PASSWORD_RESET_MESSAGE);
      } else await signInWithEmail(email, password);
    } catch (failure) {
      setError(authErrorMessage(failure));
    } finally {
      setPassword("");
      setConfirmation("");
      inFlight.current = false;
      setBusy(false);
    }
  }

  const inputClass = "mt-1 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-base text-white";
  return <main className="flex min-h-screen items-center justify-center bg-slate-950 p-4 text-white">
    <section className="w-full max-w-sm rounded-xl border border-slate-800 bg-slate-900 p-5">
      <h1 className="text-4xl font-bold">NevFit</h1>
      <p className="mt-3 text-sm leading-6 text-slate-300">Your programs, activities and coaching in your own account.</p>
      <div className="mt-5 grid grid-cols-2 gap-2">
        {["signin", "register"].map((item) => <button key={item} type="button" disabled={busy} aria-pressed={mode === item} onClick={() => changeMode(item)} className={`min-h-11 rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-50 ${mode === item ? "bg-slate-700 text-white" : "text-slate-300"}`}>{titles[item]}</button>)}
      </div>
      <h2 className="mt-5 text-lg font-semibold">{titles[mode]}</h2>
      <form onSubmit={submit} className="mt-3 space-y-3" aria-busy={busy}>
        <label className="block text-sm font-semibold text-slate-300" htmlFor="auth-email">Email
          <input ref={emailInput} id="auth-email" type="email" autoComplete="email" inputMode="email" autoCapitalize="none" spellCheck={false} required disabled={busy} value={email} onChange={(event) => setEmail(event.target.value)} className={inputClass} />
        </label>
        {mode !== "reset" ? <label className="block text-sm font-semibold text-slate-300" htmlFor="auth-password">Password
          <input id="auth-password" type="password" autoComplete={mode === "register" ? "new-password" : "current-password"} required disabled={busy} value={password} onChange={(event) => setPassword(event.target.value)} className={inputClass} />
        </label> : <p className="text-sm text-slate-300">Enter your email to request a password reset link.</p>}
        {mode === "register" ? <label className="block text-sm font-semibold text-slate-300" htmlFor="auth-confirmation">Confirm password
          <input id="auth-confirmation" type="password" autoComplete="new-password" required disabled={busy} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className={inputClass} />
        </label> : null}
        {error ? <p role="alert" className="text-sm text-amber-200">{error}</p> : null}
        {message ? <p role="status" className="text-sm text-emerald-200">{message}</p> : null}
        <button type="submit" disabled={busy} className="min-h-11 w-full rounded-lg bg-emerald-400 px-4 py-3 text-sm font-semibold text-slate-950 disabled:opacity-50">{busy ? "Please wait…" : mode === "reset" ? "Send reset email" : titles[mode]}</button>
      </form>
      <button type="button" disabled={busy} onClick={() => changeMode(mode === "reset" ? "signin" : "reset")} className="mt-2 min-h-11 text-sm font-semibold text-slate-300 underline disabled:opacity-50">{mode === "reset" ? "Back to sign in" : "Forgot password?"}</button>
      <div className="my-3 border-t border-slate-700" />
      <button type="button" disabled={busy} onClick={() => submit(null, true)} className="min-h-11 w-full rounded-lg border border-slate-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">Sign in with Google</button>
    </section>
  </main>;
}
