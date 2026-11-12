import { useEffect, useRef, useState } from "react";
import WorkoutEditor from "./WorkoutEditor.jsx";
import { button, primary, input, Icon, TrainingDialog } from "./TrainingPrimitives.jsx";
import { newWorkoutDraft, prepareWorkoutDraft, trainingId, workoutTotals } from "../../services/trainingEditor.js";

export default function TrainingWorkspace({ runtime, onOperate, onReload, onStart, activeSession, getExercise, onExerciseLoaded, renderMetadata, navigationGuardRef, selectedProgramId, onSelectProgram, exerciseNotes, initialProgramId = null }) {
  const [tab, setTab] = useState(initialProgramId ? "programs" : "workouts"), [page, setPage] = useState(initialProgramId ? { type: "program", id: initialProgramId } : { type: "list" });
  const [archived, setArchived] = useState(false), [editor, setEditor] = useState(null), [dialog, setDialog] = useState(null);
  const [busy, setBusy] = useState(false), [notice, setNotice] = useState(null);
  const lock = useRef(false), heading = useRef(null);
  const { workouts, programs } = runtime.library;
  const workout = workouts.find((entry) => entry.id === page.id), program = programs.find((entry) => entry.id === page.id);
  const editorDirty = editor && JSON.stringify(editor.draft) !== editor.original;
  const dialogDirty = dialog?.type === "program" && (dialog.name !== dialog.originalName || dialog.description !== dialog.originalDescription);
  const dirty = Boolean(editorDirty || dialogDirty);
  useEffect(() => {
    navigationGuardRef.current = () => !lock.current && (!dirty || window.confirm("Discard your unsaved training edits?"));
    const warn = (event) => { if (dirty || lock.current) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", warn);
    return () => { navigationGuardRef.current = () => true; window.removeEventListener("beforeunload", warn); };
  }, [dirty, navigationGuardRef]);
  useEffect(() => { if (document.activeElement?.getAttribute("role") !== "tab") heading.current?.focus(); }, [page.type, page.id]);
  function leave() { return !lock.current && (!dirty || window.confirm("Discard your unsaved training edits?")); }
  function navigate(next, nextTab = tab) {
    if (!leave()) return false;
    setEditor(null); setDialog(null); setNotice(null); setTab(nextTab); setPage(next);
    return true;
  }
  async function run(operation, message, after, baseline = runtime) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setNotice(null);
    try {
      const saved = await onOperate(operation, baseline);
      after?.(saved);
      setNotice({ type: "success", message });
    } catch (error) {
      setNotice({ type: "error", message: `Not saved. Your edits are retained. ${error.message.includes("changed") ? "Training changed elsewhere. Reload the library, then cancel and reopen this draft before retrying." : error.message}` });
    } finally { lock.current = false; setBusy(false); }
  }
  async function reload() {
    if (lock.current) return;
    lock.current = true; setBusy(true);
    try { await onReload(); setNotice({ type: "success", message: editor || dialog ? "Library refreshed. Your draft is retained; cancel and reopen it to use the new baseline." : "Library refreshed." }); }
    catch { setNotice({ type: "error", message: "Couldn't refresh training. Check your connection and try again." }); }
    finally { lock.current = false; setBusy(false); }
  }
  function editWorkout(source = null, programId = null) {
    if (!leave()) return;
    const draft = source ? { ...source, exercises: source.exercises.map((entry) => ({ ...entry })) } : newWorkoutDraft(programId);
    setEditor({ draft, original: JSON.stringify(draft), baseline: runtime, isNew: !source, returnPage: source ? { type: "workout", id: source.id } : page });
    setPage({ type: "editor", id: draft.id }); setNotice(null);
  }
  function saveWorkout() {
    let draft;
    try { draft = prepareWorkoutDraft(editor.draft); }
    catch (error) { setNotice({ type: "error", message: error.message }); return; }
    run({ type: editor.isNew ? "createWorkout" : "saveWorkout", id: draft.id, workout: draft }, "Workout saved.", () => {
      setEditor(null); setPage({ type: "workout", id: draft.id });
    }, editor.baseline);
  }
  function programForm(source = null) {
    setDialog({ type: "program", id: source?.id ?? null, name: source?.name ?? "", description: source?.description ?? "", originalName: source?.name ?? "", originalDescription: source?.description ?? "", baseline: runtime });
  }
  function saveProgram(event) {
    event.preventDefault();
    const id = dialog.id ?? trainingId();
    run({ type: dialog.id ? "saveProgram" : "createProgram", id, program: { id, name: dialog.name.trim(), description: dialog.description.trim() } }, "Program saved.", () => {
      setDialog(null); setTab("programs"); setPage({ type: "program", id });
    }, dialog.baseline);
  }
  function duplicateWorkout() {
    const newId = trainingId();
    run({ type: "duplicateWorkout", id: workout.id, newId, rowIds: workout.exercises.map(trainingId) }, "Workout duplicated.", () => setPage({ type: "workout", id: newId }));
  }
  function duplicateProgram() {
    const newId = trainingId();
    run({ type: "duplicateProgram", id: program.id, newId, workoutCopies: program.workoutIds.map((id) => ({ id, newId: trainingId(), rowIds: workouts.find((entry) => entry.id === id).exercises.map(trainingId) })) }, "Program and workouts duplicated.", () => setPage({ type: "program", id: newId }));
  }
  function archiveItem(item, kind) {
    if (!window.confirm(`${item.archived ? "Restore" : "Archive"} ${item.name}?`)) return;
    run(kind === "Workout" ? { type: "archiveWorkout", id: item.id, archived: !item.archived } : { type: "saveProgram", id: item.id, program: { archived: !item.archived } }, `${kind} ${item.archived ? "restored" : "archived"}.`);
  }
  function deleteItem(item, kind) {
    if (!window.confirm(kind === "Workout" ? `Delete “${item.name}”? Future schedule assignments will be cleared. Completed history and active session snapshots will remain.` : `Delete “${item.name}”? Its workouts will be kept without a program. Completed history will remain.`)) return;
    run({ type: `delete${kind}`, id: item.id }, `${kind} deleted.`, () => setPage({ type: "list" }));
  }
  const exerciseName = (row) => row.displayNameOverride || getExercise(row.exerciseId)?.name || row.exerciseName || row.exerciseId;
  function workoutCard(item, order = null) {
    const totals = workoutTotals(item), owner = programs.find((entry) => entry.id === item.programId);
    return <button type="button" key={item.id} onClick={() => navigate({ type: "workout", id: item.id })} className="group flex w-full min-w-0 items-center gap-4 rounded-2xl border border-slate-800 bg-slate-900 p-4 text-left transition hover:border-emerald-400/60 focus-visible:outline-2 focus-visible:outline-emerald-300 sm:p-5">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-slate-800 text-sm font-semibold text-emerald-300">{order ?? <Icon name="workout-template" />}</span>
      <span className="min-w-0 flex-1"><span className="block break-words text-lg font-semibold leading-snug">{item.name}</span><span className="mt-1 block text-sm text-slate-400">{totals.exercises} exercises · {totals.sets} sets</span>{owner ? <span className="mt-2 block break-words text-xs text-emerald-200">{owner.name}{owner.archived ? " · Archived program" : ""}</span> : null}{item.archived ? <span className="mt-2 block text-xs font-semibold text-amber-200">Archived</span> : null}</span><Icon name="chevron-right" />
    </button>;
  }
  const shown = (tab === "workouts" ? workouts : programs).filter((entry) => entry.archived === archived);
  const supersets = workout ? [...new Set(workout.exercises.map((row) => row.supersetGroupId).filter(Boolean))] : [];
  return <section className="min-w-0 pb-8" aria-label="Training">
    {page.type === "list" ? <div className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">Your library</p><h1 ref={heading} tabIndex={-1} className="mt-1 text-3xl font-bold tracking-tight outline-none sm:text-4xl">Training</h1></div><button type="button" className={primary} disabled={busy} onClick={() => tab === "workouts" ? editWorkout() : programForm()}><Icon name="plus" />Create {tab === "workouts" ? "Workout" : "Program"}</button></div> : <h1 ref={heading} tabIndex={-1} className="sr-only">{editor ? "Edit Workout" : "Training"}</h1>}
    {!editor ? <div role="tablist" aria-label="Training sections" className="mb-6 flex w-full max-w-md gap-1 rounded-xl bg-slate-900 p-1">
      {["workouts", "programs"].map((value) => <button key={value} type="button" role="tab" id={`training-${value}-tab`} aria-selected={tab === value} aria-controls="training-content" tabIndex={tab === value ? 0 : -1} disabled={busy}
        onKeyDown={(event) => { if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) { event.preventDefault(); const target = event.key === "Home" ? "workouts" : event.key === "End" ? "programs" : tab === "workouts" ? "programs" : "workouts"; if (navigate({ type: "list" }, target)) document.getElementById(`training-${target}-tab`)?.focus(); } }}
        onClick={() => navigate({ type: "list" }, value)} className={`min-h-11 flex-1 rounded-lg px-5 text-sm font-bold capitalize ${tab === value ? "bg-slate-700 text-white shadow" : "text-slate-400 hover:text-white"}`}>{value}</button>)}
    </div> : null}
    {notice ? <div role={notice.type === "error" ? "alert" : "status"} className={`mb-4 rounded-xl border p-3 text-sm ${notice.type === "error" ? "border-red-400/40 bg-red-400/5 text-red-200" : "border-emerald-400/30 text-emerald-200"}`}>{notice.message}{notice.type === "error" ? <button type="button" onClick={reload} disabled={busy} className={`${button} ml-2 mt-2`}>Reload library</button> : null}</div> : null}
    <fieldset disabled={busy} id="training-content" role="tabpanel" aria-labelledby={`training-${tab}-tab`} className="min-w-0">
      {page.type === "list" ? <>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">{archived ? "Archived" : "Saved"} {tab} <span className="text-slate-500">{shown.length}</span></h2><label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={archived} onChange={(event) => setArchived(event.target.checked)} className="accent-emerald-400" />Show archived</label></div>
        {!shown.length ? <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/50 px-5 py-12 text-center"><h3 className="text-xl font-semibold">{archived ? `No archived ${tab}` : tab === "workouts" ? "Build your next workout" : "Create your first program"}</h3><p className="mx-auto mt-2 max-w-sm text-sm text-slate-400">{archived ? "Archived items will appear here." : tab === "workouts" ? "Choose your exercises. Set your pace." : "Choose workouts and put them in order."}</p>{!archived ? <div className="mt-6 flex flex-wrap justify-center gap-3"><button type="button" className={primary} onClick={() => editWorkout()}>Create Workout</button><button type="button" className={button} onClick={() => programForm()}>Create Program</button></div> : null}</div> : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{tab === "workouts" ? shown.map((item) => workoutCard(item)) : shown.map((item) => <button type="button" key={item.id} onClick={() => navigate({ type: "program", id: item.id })} className="min-w-0 rounded-2xl border border-slate-800 bg-slate-900 p-5 text-left hover:border-emerald-400/60"><Icon name="program-layers" /><h3 className="mt-3 break-words text-xl font-semibold">{item.name}</h3><p className="mt-2 text-sm text-slate-400">{item.workoutIds.length} workouts{selectedProgramId === item.id ? " · Current program" : ""}</p>{item.archived ? <p className="mt-2 text-xs text-amber-200">Archived</p> : null}</button>)}</div>}
      </> : null}
      {page.type === "workout" && workout ? <div className="mx-auto max-w-3xl">
        <button type="button" className={button} onClick={() => navigate({ type: "list" }, "workouts")}><Icon name="arrow-left" />All Workouts</button>
        <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-6"><p className="text-xs font-semibold uppercase tracking-widest text-emerald-300">Workout summary{workout.archived ? " · Archived" : ""}</p><h2 className="mt-2 break-words text-3xl font-bold">{workout.name}</h2><p className="mt-2 text-sm text-slate-400">{workoutTotals(workout).exercises} exercises · {workoutTotals(workout).sets} sets{workout.programId ? ` · ${programs.find((entry) => entry.id === workout.programId)?.name}` : ""}</p>{workout.description ? <p className="mt-3 whitespace-pre-line text-sm text-slate-300">{workout.description}</p> : null}<div className="mt-5 flex flex-wrap gap-3"><button type="button" disabled={workout.archived && !(activeSession?.routineDayId === workout.id && activeSession.sessionKind !== "quick")} onClick={() => onStart(workout)} className={primary}><Icon name="play" />{activeSession?.routineDayId === workout.id && activeSession.sessionKind !== "quick" ? "Resume Workout" : "Start Workout"}</button><button type="button" className={button} onClick={() => editWorkout(workout)}><Icon name="edit" />Edit Workout</button></div></div>
        <ol className="mt-5 space-y-3">{workout.exercises.map((row, index) => <li key={row.routineExerciseId} className={`rounded-2xl border bg-slate-900 p-4 ${row.supersetGroupId ? "border-emerald-400/30 border-l-4" : "border-slate-800"}`}>{row.supersetGroupId ? <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-300">Superset {supersets.indexOf(row.supersetGroupId) + 1}</p> : null}<h3 className="break-words font-semibold"><span className="mr-2 text-slate-500">{index + 1}.</span>{exerciseName(row)}</h3><p className="mt-1 text-sm text-slate-400">{row.sets} sets · {row.repRange} reps · {row.restSeconds == null ? "Default rest" : `${row.restSeconds}s rest`}</p>{row.note ? <p className="mt-2 whitespace-pre-line text-sm text-slate-300">{row.note}</p> : null}{exerciseNotes[row.exerciseId] ? <p className="mt-2 whitespace-pre-line text-sm text-slate-400">Personal note: {exerciseNotes[row.exerciseId]}</p> : null}</li>)}</ol>
        {!workout.exercises.length ? <p className="py-6 text-center text-sm text-slate-400">No exercises yet. Edit this workout to add some.</p> : null}
        <details className="mt-6 rounded-2xl border border-slate-800 p-4"><summary className="cursor-pointer py-1 text-sm font-semibold text-slate-300">Manage Workout</summary><div className="mt-4 flex flex-wrap gap-2"><button type="button" className={button} onClick={duplicateWorkout}><Icon name="copy" />Duplicate</button><button type="button" className={button} onClick={() => setDialog({ type: "move", workoutId: workout.id, programId: workout.programId ?? "", baseline: runtime })}>Move / detach</button><button type="button" className={button} onClick={() => archiveItem(workout, "Workout")}>{workout.archived ? "Restore" : "Archive"}</button><button type="button" className={`${button} text-red-300`} onClick={() => deleteItem(workout, "Workout")}>Delete Workout</button></div></details>
      </div> : null}
      {page.type === "program" && program ? <div className="mx-auto max-w-3xl">
        <button type="button" className={button} onClick={() => navigate({ type: "list" }, "programs")}><Icon name="arrow-left" />All Programs</button>
        <div className="my-5 rounded-2xl border border-slate-800 bg-slate-900 p-5"><p className="text-xs font-semibold uppercase tracking-widest text-emerald-300">Program{program.archived ? " · Archived" : ""}</p><h2 className="mt-2 break-words text-3xl font-bold">{program.name}</h2><p className="mt-2 text-sm text-slate-400">{program.workoutIds.length} workouts{selectedProgramId === program.id ? " · Current program" : ""}</p>{program.description ? <p className="mt-3 whitespace-pre-line text-sm text-slate-300">{program.description}</p> : null}<div className="mt-4 flex flex-wrap gap-2"><button type="button" className={primary} onClick={() => editWorkout(null, program.id)}>Create Workout</button><button type="button" className={button} disabled={!workouts.some((entry) => entry.programId !== program.id)} onClick={() => setDialog({ type: "attach", programId: program.id, workoutId: workouts.find((entry) => entry.programId !== program.id)?.id ?? "", baseline: runtime })}>Add Existing</button><button type="button" className={button} onClick={() => programForm(program)}>Edit Program</button>{!program.archived && selectedProgramId !== program.id ? <button type="button" className={button} onClick={() => onSelectProgram(program.id)}>Use as Current Program</button> : null}</div></div>
        <ol className="space-y-3">{program.workoutIds.map((id, index) => { const item = workouts.find((entry) => entry.id === id); return <li key={id}>{workoutCard(item, index + 1)}<div className="mt-2 flex flex-wrap gap-2"><button type="button" disabled={index === 0} aria-label={`Move ${item.name} up`} className={button} onClick={() => run({ type: "moveWorkout", id, programId: program.id, index: index - 1 }, "Workout order saved.")}>↑ Up</button><button type="button" disabled={index === program.workoutIds.length - 1} aria-label={`Move ${item.name} down`} className={button} onClick={() => run({ type: "moveWorkout", id, programId: program.id, index: index + 1 }, "Workout order saved.")}>↓ Down</button><button type="button" className={button} onClick={() => editWorkout(item)}>Edit</button><button type="button" className={button} onClick={() => setDialog({ type: "move", workoutId: id, programId: program.id, baseline: runtime })}>Move / detach</button></div></li>; })}</ol>
        {!program.workoutIds.length ? <p className="py-6 text-center text-sm text-slate-400">No workouts yet.</p> : null}
        <details className="mt-6 rounded-2xl border border-slate-800 p-4"><summary className="cursor-pointer py-1 text-sm font-semibold text-slate-300">Manage Program</summary><div className="mt-4 flex flex-wrap gap-2"><button type="button" className={button} onClick={duplicateProgram}>Duplicate Program</button><button type="button" className={button} onClick={() => archiveItem(program, "Program")}>{program.archived ? "Restore" : "Archive"}</button><button type="button" className={`${button} text-red-300`} onClick={() => deleteItem(program, "Program")}>Delete Program</button></div></details>
      </div> : null}
      {page.type === "editor" && editor ? <WorkoutEditor draft={editor.draft} setDraft={(update) => setEditor((current) => ({ ...current, draft: typeof update === "function" ? update(current.draft) : update }))} dirty={editorDirty} busy={busy} onSave={saveWorkout} onCancel={() => { if (leave()) { const back = editor.returnPage; setEditor(null); setPage(back); setNotice(null); } }} getExercise={getExercise} onExerciseLoaded={onExerciseLoaded} renderMetadata={renderMetadata} /> : null}
      {page.type !== "list" && page.type !== "editor" && !(page.type === "workout" ? workout : program) ? <p className="text-slate-400">This item is no longer available. <button type="button" className={button} onClick={() => navigate({ type: "list" })}>Back to library</button></p> : null}
    </fieldset>
    {busy ? <p role="status" className="mt-3 text-sm text-emerald-200">Saving changes…</p> : null}
    {dialog ? <TrainingDialog title={dialog.type === "program" ? dialog.id ? "Edit Program" : "Create Program" : dialog.type === "attach" ? "Add existing workout" : "Move Workout"} busy={busy} onClose={() => { if (leave()) setDialog(null); }}>
      {notice ? <div role={notice.type === "error" ? "alert" : "status"} className="mb-4 text-sm text-slate-200"><p>{notice.message}</p>{notice.type === "error" ? <button type="button" onClick={reload} disabled={busy} className={`${button} mt-2`}>Reload library</button> : null}</div> : null}
      {dialog.type === "program" ? <form onSubmit={saveProgram}><fieldset disabled={busy} className="space-y-4"><label className="block text-sm font-semibold">Program name<input required value={dialog.name} onChange={(event) => setDialog({ ...dialog, name: event.target.value })} className={input} /></label><label className="block text-sm text-slate-300">Description<textarea rows={2} value={dialog.description} onChange={(event) => setDialog({ ...dialog, description: event.target.value })} className={input} /></label><button type="submit" className={primary}>Save Program</button></fieldset></form> : <form onSubmit={(event) => {
        event.preventDefault();
        run({ type: "moveWorkout", id: dialog.workoutId, programId: dialog.programId || null }, "Workout membership saved.", () => setDialog(null), dialog.baseline);
      }}><fieldset disabled={busy} className="space-y-4">{dialog.type === "attach" ? <label className="block text-sm font-semibold">Workout<select required className={input} value={dialog.workoutId} onChange={(event) => setDialog({ ...dialog, workoutId: event.target.value })}>{workouts.filter((entry) => entry.programId !== dialog.programId).map((entry) => <option key={entry.id} value={entry.id}>{entry.name}{entry.programId ? ` — Move from ${programs.find((owner) => owner.id === entry.programId)?.name}` : ""}{entry.archived ? " (archived)" : ""}</option>)}</select></label> : <label className="block text-sm font-semibold">Program<select className={input} value={dialog.programId} onChange={(event) => setDialog({ ...dialog, programId: event.target.value })}><option value="">No program (detach)</option>{programs.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}{entry.archived ? " (archived)" : ""}</option>)}</select></label>}<p className="text-sm text-slate-400">Moving removes the workout from its previous program. Its history and schedule are retained.</p><button type="submit" className={primary}>Confirm {dialog.type === "attach" && !workouts.find((entry) => entry.id === dialog.workoutId)?.programId ? "Add" : "Move"} Workout</button></fieldset></form>}
    </TrainingDialog> : null}
  </section>;
}
