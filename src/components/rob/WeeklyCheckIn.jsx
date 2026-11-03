import { useEffect, useRef, useState } from "react";
import { loadCompletedWorkouts } from "../../services/workoutHistoryStore.js";
import { loadHealthState, saveHealthSteps } from "../../services/healthStore.js";
import { loadRobCoachingProfile } from "../../services/rob/robCoachingProfileStore.js";
import { requestRobWeeklyReview } from "../../services/rob/robClient.js";
import { buildRobWeeklyContext } from "../../services/rob/robWeeklyContext.js";
import { completeWeeklyCheckIn, prepareWeeklyCheckInEvidence, stepDraftsForWeek } from "../../services/rob/weeklyCheckIn.js";
import { loadWeeklyCheckIn, saveWeeklyCheckIn } from "../../services/rob/weeklyCheckInStore.js";

const dayLabel = (date) => new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
const rangeLabel = (start, end) => `${dayLabel(start)} – ${dayLabel(end)}`;
const feelings = [["good", "Good"], ["okay", "Okay"], ["tough", "Tough"]];
const loadSyncedHealth = (uid) => loadHealthState(uid, { serverOnly: true });
const loadSyncedWorkouts = (uid) => loadCompletedWorkouts(uid, { serverOnly: true });
const loadSyncedProfile = (uid) => loadRobCoachingProfile(uid, { serverOnly: true });

export default function WeeklyCheckIn({ uid, period, healthPersistQueueRef, ownerUidRef, onHealthSynced, onSaved, onOpenRunLogger }) {
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [review, setReview] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [baseline, setBaseline] = useState({});
  const [activity, setActivity] = useState(null);
  const [feeling, setFeeling] = useState("");
  const [note, setNote] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const requestRef = useRef(0);
  const inFlightRef = useRef(false);

  useEffect(() => {
    const requests = requestRef;
    const requestId = ++requestRef.current;
    const current = () => requestRef.current === requestId && ownerUidRef.current === uid;
    async function load() {
      setStatus("loading");
      setError("");
      setReview(null);
      try {
        const saved = await loadWeeklyCheckIn(uid, period.start);
        if (!current()) return;
        if (saved) {
          setReview(saved);
          setStatus("saved");
          return;
        }
        await healthPersistQueueRef.current;
        const [health, workouts] = await Promise.all([loadSyncedHealth(uid), loadSyncedWorkouts(uid)]);
        if (!current()) return;
        const initial = stepDraftsForWeek(health?.steps ?? {}, period.dates);
        setDrafts(initial);
        setBaseline(initial);
        setActivity(buildRobWeeklyContext({ selectedDate: period.start, completedWorkouts: workouts, runs: health?.runs ?? [], stepsByDate: health?.steps ?? {} }).current);
        setStatus("ready");
      } catch {
        if (!current()) return;
        setError("Synced check-in activity could not be loaded. Retry when your connection is available.");
        setStatus("error");
      }
    }
    load();
    return () => { requests.current++; };
  }, [uid, period, healthPersistQueueRef, ownerUidRef, reloadKey]);

  async function generate() {
    if (status !== "ready" || inFlightRef.current || ownerUidRef.current !== uid) return;
    inFlightRef.current = true;
    const requestId = ++requestRef.current;
    const current = () => requestRef.current === requestId && ownerUidRef.current === uid;
    setStatus("generating");
    setError("");
    try {
      const { health, context } = await prepareWeeklyCheckInEvidence({
        uid, period, baseline, drafts,
        selfReport: feeling || note.trim() ? { feeling: feeling || null, note: note.trim() } : null,
        waitForHealthWrites: () => healthPersistQueueRef.current,
        loadHealth: loadSyncedHealth, saveHealth: saveHealthSteps, loadWorkouts: loadSyncedWorkouts, loadProfile: loadSyncedProfile, isCurrent: current,
      });
      if (!current()) return;
      onHealthSynced(health);
      const completed = await completeWeeklyCheckIn({ uid, period, context, loadReview: loadWeeklyCheckIn, requestReview: requestRobWeeklyReview, saveReview: saveWeeklyCheckIn, isCurrent: current });
      if (!current()) return;
      setReview(completed.review);
      setStatus(completed.saved ? "saved" : "unsaved");
      if (completed.saved) onSaved(completed.review);
      else setError("Rob's review was generated but could not be saved. Retry saving it without another AI request.");
    } catch (failure) {
      if (!current()) return;
      setError(failure?.message === "invalid_steps" ? "Enter whole non-negative step counts, or leave a day blank." : "Synced activity or Rob's review failed. Check your connection and retry; no check-in was completed.");
      setStatus("ready");
    } finally {
      inFlightRef.current = false;
    }
  }

  async function retrySave() {
    if (status !== "unsaved" || !review || inFlightRef.current || ownerUidRef.current !== uid) return;
    inFlightRef.current = true;
    const requestId = ++requestRef.current;
    setStatus("saving");
    setError("");
    try {
      await saveWeeklyCheckIn(uid, review);
      if (requestRef.current !== requestId || ownerUidRef.current !== uid) return;
      setStatus("saved");
      onSaved(review);
    } catch {
      if (requestRef.current !== requestId || ownerUidRef.current !== uid) return;
      setStatus("unsaved");
      setError("The review still could not be saved. Retry saving when your connection is available.");
    } finally {
      inFlightRef.current = false;
    }
  }

  return <div className="space-y-4">
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <p className="text-sm font-semibold text-emerald-200">Previous completed week · {rangeLabel(period.start, period.end)}</p>
      <p className="mt-1 text-sm text-slate-400">Compared with {rangeLabel(period.precedingStart, period.precedingEnd)}. Missing records stay unknown.</p>
    </div>
    {status === "loading" ? <p className="rounded-2xl border border-slate-800 bg-slate-900 p-5 text-slate-300">Loading your saved check-in and synced activity…</p> : null}
    {status === "error" ? <div role="alert" className="rounded-2xl border border-amber-400/40 bg-slate-900 p-5 text-amber-100"><p>{error}</p><button type="button" onClick={() => setReloadKey((value) => value + 1)} className="mt-3 font-semibold underline">Retry loading</button></div> : null}
    {status === "ready" || status === "generating" ? <>
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <h3 className="font-semibold text-white">Complete last week's activity</h3>
        <p className="mt-1 text-sm text-slate-400">Correct steps if needed. Blank means no step record; 0 is a recorded day. Seven entries are optional.</p>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {period.dates.map((date) => <label key={date} className="text-sm text-slate-300">{dayLabel(date)}<input type="number" inputMode="numeric" min="0" step="1" value={drafts[date] ?? ""} disabled={status === "generating"} onChange={(event) => setDrafts((current) => ({ ...current, [date]: event.target.value }))} placeholder="Missing" className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-white" /></label>)}
        </div>
        <p className="mt-4 text-sm text-slate-300">{activity?.strength.sessionCount ?? 0} completed strength sessions · {activity?.runs.count ?? 0} logged runs</p>
        {activity?.strength.sessions.length ? <p className="mt-1 text-xs text-slate-400">Strength: {activity.strength.sessions.slice(0, 4).map((session) => `${dayLabel(session.date)} ${session.routine}`).join(" · ")}{activity.strength.sessionCount > 4 ? " · more in history" : ""}</p> : null}
        {activity?.runs.runs.length ? <p className="mt-1 text-xs text-slate-400">Runs: {activity.runs.runs.slice(0, 4).map((run) => `${dayLabel(run.date)}${run.distanceKm ? ` ${run.distanceKm} km` : ""}`).join(" · ")}{activity.runs.count > 4 ? " · more logged" : ""}</p> : null}
        <button type="button" onClick={onOpenRunLogger} disabled={status === "generating"} className="mt-2 text-sm font-semibold text-emerald-200 underline disabled:opacity-50">Add a run in Dashboard</button>
        <p className="mt-2 text-xs text-slate-500">Completed workouts can be viewed in history; they are read-only here.</p>
      </div>
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <h3 className="font-semibold text-white">How did the week feel? <span className="font-normal text-slate-400">Optional</span></h3>
        <div className="mt-3 flex flex-wrap gap-2">{feelings.map(([value, label]) => <button key={value} type="button" aria-pressed={feeling === value} disabled={status === "generating"} onClick={() => setFeeling((current) => current === value ? "" : value)} className={`rounded-lg border px-3 py-2 text-sm ${feeling === value ? "border-emerald-300 bg-emerald-400/15 text-emerald-100" : "border-slate-700 text-slate-300"}`}>{label}</button>)}</div>
        <label className="mt-4 block text-sm text-slate-300">Anything Rob should know? <span className="text-slate-500">Optional, up to 400 characters</span><textarea value={note} maxLength={400} disabled={status === "generating"} onChange={(event) => setNote(event.target.value)} rows="3" className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 p-3 text-white" /></label>
        <p className="mt-1 text-xs text-slate-500">Your note is sent for this review and is not stored with the saved response.</p>
        <button type="button" onClick={generate} disabled={status === "generating"} className="mt-4 rounded-lg bg-emerald-400 px-4 py-2 font-semibold text-slate-950 disabled:opacity-50">{status === "generating" ? "Syncing activity and asking Rob…" : "Generate weekly review"}</button>
      </div>
    </> : null}
    {error && status !== "error" ? <p role="alert" className="rounded-xl border border-amber-400/40 bg-amber-400/10 p-4 text-sm text-amber-100">{error}</p> : null}
    {review ? <article className="rounded-2xl border border-slate-800 bg-slate-900 p-5"><h3 className="font-semibold text-emerald-200">{status === "saved" ? "Saved weekly review" : "Review awaiting save"}</h3><p className="mt-3 whitespace-pre-wrap text-slate-100">{review.text}</p>{status === "unsaved" ? <button type="button" onClick={retrySave} className="mt-4 rounded-lg bg-emerald-400 px-4 py-2 font-semibold text-slate-950">Retry saving review</button> : null}</article> : null}
  </div>;
}
