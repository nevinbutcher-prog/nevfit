import { useRef, useState } from "react";
import { auth, db, firebaseApp } from "../services/firebase.js";
import { exportTrainingReadiness, downloadTrainingReadiness } from "../services/trainingReadinessStore.js";
import { createIndependentWorkoutStageFirestore } from "../services/independentWorkoutStageFirestore.js";
import { prepareIndependentWorkoutStage, stageIndependentWorkouts } from "../services/independentWorkoutStage.js";
import { encodeFirestoreValue } from "../services/firestoreValueCodec.js";

const enabled = import.meta.env.VITE_TRAINING_TRANSITION_ENABLED === "true";
export default function TrainingTransition({ uid, ownerUidRef, activeSession, hasUnsavedChanges, onActivated, onUncertain, importing }) {
  const [preview, setPreview] = useState(null);
  const [message, setMessage] = useState("");
  const [project, setProject] = useState("");
  const [paused, setPaused] = useState(false);
  const [rulesReleased, setRulesReleased] = useState(false);
  const [retained, setRetained] = useState(false);
  const [stageText, setStageText] = useState("");
  const [activateText, setActivateText] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false), privateInput = useRef(null);
  const projectId = firebaseApp.options.projectId;
  const isCurrent = () => ownerUidRef.current === uid && auth.currentUser?.uid === uid;
  const safe = paused && rulesReleased && retained && project === projectId && !activeSession && !hasUnsavedChanges && !importing;
  async function run(action) {
    if (lock.current || !isCurrent()) return;
    lock.current = true; setBusy(true);
    try {
      if (action === "prepare") {
        if (activeSession || hasUnsavedChanges || importing || !paused) throw new Error("pause_and_save_first");
        const backup = await exportTrainingReadiness(uid, isCurrent);
        const stage = await prepareIndependentWorkoutStage({ uid, projectId, backup, current: backup, firestore: db });
        if (!isCurrent()) return;
        const adapter = createIndependentWorkoutStageFirestore({ uid, firestore: db, auth, isMounted: isCurrent, backup });
        const inventory = await adapter.readTargetsFromServer();
        if (!isCurrent()) return;
        const planned = new Map(stage.documents.map((entry) => [entry.path, entry]));
        if (inventory.documents.some((entry) => !planned.has(entry.path) || JSON.stringify(encodeFirestoreValue(entry)) !== JSON.stringify(encodeFirestoreValue(planned.get(entry.path))))) throw new Error("target_conflict");
        if (inventory.marker?.status === "verified" && inventory.documents.length !== stage.documents.length) throw new Error("verified_inventory_mismatch");
        if (inventory.marker && (inventory.marker.sourceFingerprint !== stage.sourceFingerprint || inventory.marker.targetFingerprint !== stage.targetFingerprint)) throw new Error("stale_stage_requires_review");
        downloadTrainingReadiness(backup);
        privateInput.current = { backup, attemptId: inventory.marker?.attemptId ?? crypto.randomUUID(), generatedAt: Date.now() };
        setRetained(false); setStageText(""); setActivateText("");
        setPreview({ counts: stage.counts, targetCount: stage.documents.length, verified: inventory.marker?.status === "verified" });
        setMessage("Fresh backup download prepared. Save it privately, confirm the account/counts and retain the attempt report. No data has been staged by this action.");
        return;
      }
      if (!enabled || !safe || !privateInput.current || Date.now() - privateInput.current.generatedAt > 15 * 60 * 1000) throw new Error("fresh_backup_and_confirmations_required");
      const { backup, attemptId } = privateInput.current;
      const adapter = createIndependentWorkoutStageFirestore({ uid, firestore: db, auth, isMounted: isCurrent, backup, enabled: true, confirmation: stageText });
      if (action === "stage") {
        if (stageText !== `STAGE ${uid}`) throw new Error("stage_confirmation_required");
        const result = await stageIndependentWorkouts({ uid, projectId, backup, firestore: db, attemptId, adapter, isCurrent });
        if (!isCurrent()) return;
        const url = URL.createObjectURL(new Blob([JSON.stringify(result, null, 2)], { type: "application/json" }));
        const link = document.createElement("a"); link.href = url; link.download = "nevfit-training-transition-stage-report.json"; link.click(); URL.revokeObjectURL(url);
        if (!result.ok) throw new Error(result.error);
        const readback = await adapter.readTargetsFromServer();
        if (!isCurrent()) return;
        if (readback.marker?.status !== "verified" || readback.documents.length !== preview.targetCount) throw new Error("stage_readback_failed");
        setPreview({ ...preview, verified: true }); setStageText(""); setActivateText("");
        setMessage(`Verified ${readback.documents.length} staged documents. Legacy remains authoritative. Activation is a separate action below.`);
      } else {
        if (!preview.verified || activateText !== `ACTIVATE ${uid}`) throw new Error("activation_confirmation_required");
        await adapter.activateStage({ confirmation: activateText, attemptId });
        if (isCurrent()) onActivated();
      }
    } catch (error) {
      if (isCurrent()) {
        setMessage(`Transition stopped: ${error.message}. No reset or overwrite was attempted. Regenerate the backup after changes; review conflicts before retrying.`);
        if (error.message === "activation_outcome_unknown_refresh") onUncertain();
      }
    } finally { lock.current = false; if (isCurrent()) setBusy(false); }
  }
  return <details className="mt-5 border-t border-slate-700 pt-4">
    <summary className="cursor-pointer font-semibold text-amber-200">Operator: independent workout transition</summary>
    <p className="mt-2 break-words text-sm text-slate-300">Project {projectId} · UID {uid}. Legacy originals and completed history are retained. No automatic migration. {enabled ? "Manual actions enabled for this build." : "Writes disabled in this build."}</p>
    <label className="mt-3 flex gap-2 text-sm"><input type="checkbox" checked={paused} onChange={(event) => setPaused(event.target.checked)} />All edits are saved, sync has settled and training/editing is paused on every device.</label>
    <label className="mt-2 flex gap-2 text-sm"><input type="checkbox" checked={rulesReleased} onChange={(event) => setRulesReleased(event.target.checked)} />The reviewed checkpoint 070 rules have been separately released to this exact project.</label>
    <label className="mt-3 block text-sm">Type project ID<input value={project} onChange={(event) => setProject(event.target.value)} className="mt-1 block w-full rounded border border-slate-600 bg-slate-950 p-2" /></label>
    <button type="button" disabled={busy || !paused || importing || Boolean(activeSession) || hasUnsavedChanges} onClick={() => run("prepare")} className="mt-3 rounded border border-slate-600 px-3 py-2 text-sm disabled:opacity-50">1. Download fresh backup and inspect</button>
    {activeSession || hasUnsavedChanges ? <p className="mt-2 text-sm text-amber-200">Finish/discard your active session and save program edits before preparing a transition.</p> : null}
    {preview ? <>
      <p className="mt-3 text-sm">Fresh source: {preview.counts.programs} programs, {preview.counts.completedWorkouts} completed sessions, {preview.counts.appState} app-state documents; {preview.targetCount} planned target documents. Readback: {preview.verified ? "verified stage present" : "not staged"}. Backup validity expires after 15 minutes or any source change.</p>
      <label className="mt-2 flex gap-2 text-sm"><input type="checkbox" checked={retained} onChange={(event) => setRetained(event.target.checked)} />I saved this fresh private file. It is not a tested full-account restore.</label>
      <label className="mt-3 block text-sm">Type STAGE {uid}<input value={stageText} onChange={(event) => setStageText(event.target.value)} className="mt-1 block w-full rounded border border-slate-600 bg-slate-950 p-2" /></label>
      <button type="button" disabled={!enabled || busy || !safe || stageText !== `STAGE ${uid}`} onClick={() => run("stage")} className="mt-2 rounded border border-amber-300/50 px-3 py-2 text-sm disabled:opacity-50">2. Stage and verify copies</button>
      <label className="mt-3 block text-sm">Separately type ACTIVATE {uid}<input value={activateText} onChange={(event) => setActivateText(event.target.value)} className="mt-1 block w-full rounded border border-slate-600 bg-slate-950 p-2" /></label>
      <button type="button" disabled={!enabled || busy || !safe || !preview.verified || activateText !== `ACTIVATE ${uid}`} onClick={() => run("activate")} className="mt-2 rounded border border-red-300/50 px-3 py-2 text-sm disabled:opacity-50">3. Activate independent runtime</button>
    </> : null}
    {message ? <p role="status" className="mt-3 text-sm text-amber-200">{message}</p> : null}
  </details>;
}
