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

  const focusClass = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900";
  const inputClass = "mt-1 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2 text-base text-white outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20 disabled:opacity-50";
  return <main className="flex min-h-dvh items-start justify-center bg-slate-950 bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.08),transparent_60%)] px-4 py-6 text-white sm:items-center sm:py-8">
    <section className="w-full min-w-0 max-w-sm rounded-3xl border border-slate-800 bg-slate-900 p-5 shadow-2xl shadow-black/20 sm:p-6">
      <header>
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-5xl font-extrabold tracking-tight">NevFit</h1>
          <div aria-hidden="true" className="flex h-10 w-10 shrink-0 items-end justify-center gap-1 rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-2">
            <span className="h-2 w-1 rounded-sm bg-emerald-400/50" />
            <span className="h-3.5 w-1 rounded-sm bg-emerald-400/75" />
            <span className="h-5 w-1 rounded-sm bg-emerald-400" />
          </div>
        </div>
        <p className="mt-3 font-semibold text-emerald-200">Train with purpose.</p>
        <p className="mt-1 text-sm leading-5 text-slate-400">Build your routine. Track your progress. Get stronger.</p>
      </header>
      <div role="group" aria-label="Account access" className="mt-5 grid grid-cols-2 gap-1 rounded-xl border border-slate-800 bg-slate-950/70 p-1">
        {["signin", "register"].map((item) => <button key={item} type="button" disabled={busy} aria-pressed={mode === item} onClick={() => changeMode(item)} className={`min-h-11 rounded-lg px-3 py-2 text-sm font-semibold transition disabled:opacity-50 ${focusClass} ${mode === item ? "bg-slate-700 text-white ring-1 ring-inset ring-emerald-400/30" : "text-slate-400 hover:bg-slate-800 hover:text-white"}`}>{titles[item]}</button>)}
      </div>
      <h2 id="auth-mode-title" className={mode === "reset" ? "mt-4 text-lg font-semibold" : "sr-only"}>{titles[mode]}</h2>
      <form onSubmit={submit} className="mt-4 space-y-3" aria-busy={busy} aria-labelledby="auth-mode-title">
        <label className="block text-sm font-semibold text-slate-300" htmlFor="auth-email">Email
          <input ref={emailInput} id="auth-email" type="email" autoComplete="email" inputMode="email" autoCapitalize="none" spellCheck={false} required disabled={busy} value={email} onChange={(event) => setEmail(event.target.value)} className={inputClass} />
        </label>
        {mode !== "reset" ? <label className="block text-sm font-semibold text-slate-300" htmlFor="auth-password">Password
          <input id="auth-password" type="password" autoComplete={mode === "register" ? "new-password" : "current-password"} required disabled={busy} value={password} onChange={(event) => setPassword(event.target.value)} className={inputClass} />
        </label> : <p className="text-sm text-slate-300">Enter your email to request a password reset link.</p>}
        {mode === "register" ? <label className="block text-sm font-semibold text-slate-300" htmlFor="auth-confirmation">Confirm password
          <input id="auth-confirmation" type="password" autoComplete="new-password" required disabled={busy} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className={inputClass} />
        </label> : null}
        {error ? <p role="alert" className="break-words rounded-xl border border-amber-300/20 bg-amber-300/5 px-3 py-2 text-sm leading-5 text-amber-200">{error}</p> : null}
        {message ? <p role="status" className="break-words rounded-xl border border-emerald-300/20 bg-emerald-300/5 px-3 py-2 text-sm leading-5 text-emerald-200">{message}</p> : null}
        <button type="submit" disabled={busy} className={`min-h-11 w-full rounded-xl bg-emerald-400 px-4 py-2.5 text-sm font-bold text-slate-950 shadow-lg shadow-emerald-950/30 transition hover:bg-emerald-300 disabled:opacity-50 ${focusClass}`}>{busy ? "Please wait…" : mode === "reset" ? "Send reset email" : titles[mode]}</button>
      </form>
      <button type="button" disabled={busy} onClick={() => changeMode(mode === "reset" ? "signin" : "reset")} className={`mt-1 flex min-h-11 items-center rounded-lg px-1 text-sm text-slate-400 underline decoration-slate-600 underline-offset-4 transition hover:text-slate-200 disabled:opacity-50 ${focusClass}`}>{mode === "reset" ? "Back to sign in" : "Forgot password?"}</button>
      <div className="mb-3 mt-1 flex items-center gap-3 text-xs text-slate-500">
        <span aria-hidden="true" className="h-px flex-1 bg-slate-800" />
        <span>or continue with</span>
        <span aria-hidden="true" className="h-px flex-1 bg-slate-800" />
      </div>
      <button type="button" disabled={busy} onClick={() => submit(null, true)} className={`min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950/30 px-4 py-2.5 text-sm font-semibold text-slate-300 transition hover:border-slate-500 hover:bg-slate-800 hover:text-white disabled:opacity-50 ${focusClass}`}>Sign in with Google</button>
    </section>
  </main>;
}
