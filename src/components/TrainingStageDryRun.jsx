import { useRef, useState } from "react";
import { db } from "../services/firebase.js";
import { exportTrainingReadiness } from "../services/trainingReadinessStore.js";
import { prepareIndependentWorkoutStage } from "../services/independentWorkoutStage.js";
import { encodeFirestoreValue } from "../services/firestoreValueCodec.js";

// Rendered only by the development build. No live staging adapter or write action.
export default function TrainingStageDryRun({ uid, ownerUidRef }) {
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState("");
  const busy = useRef(false);
  async function run() {
    if (!file || busy.current) return;
    busy.current = true;
    const currentAccount = () => ownerUidRef.current === uid;
    setStatus("Verifying the private file and fresh server sources…");
    try {
      const backup = JSON.parse(await file.text());
      if (!currentAccount()) return;
      const current = await exportTrainingReadiness(uid, currentAccount);
      const stage = await prepareIndependentWorkoutStage({ uid, projectId: current.account.projectId, backup, current, firestore: db });
      if (!currentAccount()) return;
      const report = { format: "nevfit-training-stage-dry-run", mode: "dry-run-only", account: current.account,
        sourceFingerprint: stage.sourceFingerprint, targetFingerprint: stage.targetFingerprint, counts: stage.counts,
        mappings: stage.mappings, targets: stage.documents.map((entry) => ({ path: entry.path, value: encodeFirestoreValue(entry.data) })),
        activationAllowed: false, cutoverAllowed: false, targetChecks: "not performed: current rules deny target collection access",
      };
      const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = "nevfit-training-stage-dry-run.json";
      link.click();
      URL.revokeObjectURL(url);
      setStatus(`Dry run prepared for ${stage.documents.length} target documents. Nothing staged. Target access and manual activation remain blocked.`);
    } catch {
      if (currentAccount()) setStatus("Dry run rejected: check backup identity/integrity, source drift, active sessions and preflight errors. No migration writes occurred.");
    } finally { busy.current = false; }
  }
  return <details className="mt-5 border-t border-slate-700 pt-4">
    <summary className="cursor-pointer font-semibold text-amber-200">Developer: staging dry run only</summary>
    <p className="mt-2 break-words text-sm text-slate-300">UID {uid}. Pause edits on all devices and choose your privately retained training-readiness JSON. Files are checked locally. This never stages, deletes or switches storage. Current rules block activation; a future reviewed adapter and owner-only rules are required.</p>
    <input type="file" accept="application/json,.json" onChange={(event) => setFile(event.target.files?.[0] ?? null)} className="mt-3 block max-w-full text-sm" />
    <button type="button" disabled={!file} onClick={run} className="mt-3 rounded-lg border border-amber-300/50 px-3 py-2 text-sm font-semibold text-amber-200 disabled:opacity-50">Verify backup and prepare dry run</button>
    {status ? <p role="status" className="mt-2 text-sm text-slate-300">{status}</p> : null}
  </details>;
}
