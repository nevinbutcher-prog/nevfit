const messages = {
  "invalid-session": "The saved workout contains incomplete or invalid session data.",
  "empty-session": "This saved workout has no loggable exercises or sets.",
  "missing-reference": "The workout or scheduled day linked to this session is no longer available.",
  "model-mismatch": "This saved session does not match the account's current training model.",
};
export default function WorkoutRecovery({ reason, onReturn, onDiscard, busy, error }) {
  return <section role="alert" className="mx-auto max-w-xl rounded-2xl border border-amber-400/40 bg-slate-900 p-5 text-white">
    <h2 className="text-xl font-bold">{reason ? "Workout needs attention" : "No workout to resume"}</h2>
    <p className="mt-3 text-sm text-slate-300">{messages[reason] ?? "There is no active workout to display."}</p>
    {reason ? <p className="mt-2 text-sm text-slate-400">Return to Dashboard to keep the saved session, or discard this unfinished workout. Completed history will stay unchanged.</p> : null}
    <div className="mt-5 flex flex-wrap gap-3">
      <button type="button" onClick={onReturn} className="min-h-11 rounded-xl bg-emerald-400 px-4 py-2 font-semibold text-slate-950">Return to Dashboard</button>
      {reason ? <button type="button" disabled={busy} onClick={onDiscard} className="min-h-11 rounded-xl border border-red-400/50 px-4 py-2 font-semibold text-red-200 disabled:opacity-50">{busy ? "Discarding…" : "Discard Workout"}</button> : null}
    </div>
    {error ? <p className="mt-3 text-sm text-red-200">{error}</p> : null}
  </section>;
}
