import { useState } from "react";
import RepRangeEditor from "../RepRangeEditor.jsx";
import TrainingExercisePicker from "./TrainingExercisePicker.jsx";
import { button, input, primary, Icon } from "./TrainingPrimitives.jsx";
import { addRoutineExercise, moveRoutineExercise, removeRoutineExercise, replaceRoutineExercise, updateRoutineExerciseSuperset } from "../../services/routineBuilder.js";
import { trainingId, workoutExercise } from "../../services/trainingEditor.js";

export default function WorkoutEditor({ draft, setDraft, onSave, onCancel, busy, dirty, getExercise, onExerciseLoaded, renderMetadata }) {
  const [picker, setPicker] = useState(null);
  const patch = (fields) => setDraft((current) => ({ ...current, ...fields }));
  const rows = (transform) => setDraft((current) => ({ ...current, exercises: transform(current.exercises) }));
  const name = (row) => row.displayNameOverride || getExercise(row.exerciseId)?.name || row.exerciseId;
  function select(exercise) {
    onExerciseLoaded(exercise);
    if (picker.swapIndex === null) rows((entries) => addRoutineExercise(entries, workoutExercise(exercise)).exercises);
    else { rows((entries) => replaceRoutineExercise(entries, picker.swapIndex, exercise.id)); setPicker(null); }
  }
  return <form onSubmit={(event) => { event.preventDefault(); onSave(); }} className="mx-auto max-w-3xl">
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-widest text-emerald-300">Workout editor</p><h2 className="mt-1 break-words text-2xl font-bold">{draft.name || "New workout"}</h2><p className="mt-1 text-sm text-slate-400">{dirty ? "Unsaved changes" : "No unsaved changes"}</p></div><div className="flex gap-2"><button type="button" className={button} disabled={busy} onClick={onCancel}>Cancel</button><button type="submit" className={primary} disabled={busy}>{busy ? "Saving…" : "Save Workout"}</button></div></div>
    <fieldset disabled={busy} className="min-w-0 space-y-4">
      <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900 p-4">
        <label className="block text-sm font-semibold">Workout name<input required maxLength={160} value={draft.name} onChange={(event) => patch({ name: event.target.value })} className={input} /></label>
        <label className="block text-sm text-slate-300">Description <span className="text-slate-500">(optional)</span><textarea rows={2} value={draft.description ?? ""} onChange={(event) => patch({ description: event.target.value })} className={input} /></label>
      </div>
      <div className="flex items-center justify-between gap-3"><h3 className="text-lg font-bold">Exercises <span className="text-slate-500">{draft.exercises.length}</span></h3><button type="button" onClick={() => setPicker({ swapIndex: null })} className={button}><Icon name="plus" />Add Exercises</button></div>
      {!draft.exercises.length ? <p className="rounded-2xl border border-dashed border-slate-700 p-6 text-center text-sm text-slate-400">Add your first exercise.</p> : null}
      {draft.exercises.map((row, index) => <details key={row.routineExerciseId} className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
        <summary className="cursor-pointer break-words font-semibold"><span className="mr-2 text-sm text-emerald-300">{index + 1}.</span>{name(row)}<span className="mt-1 block pl-5 text-sm font-normal text-slate-400">{row.sets} sets · {row.repRange} reps · {row.restSeconds == null || row.restSeconds === "" ? "Default rest" : `${row.restSeconds}s rest`}{row.supersetGroupId ? " · Superset" : ""}</span></summary>
        <div className="mt-4 grid min-w-0 gap-4 sm:grid-cols-2">
          <label className="text-sm text-slate-300 sm:col-span-2">Display name<input value={row.displayNameOverride ?? ""} placeholder={getExercise(row.exerciseId)?.name ?? "Catalogue name"} onChange={(event) => rows((entries) => entries.map((entry, i) => i === index ? { ...entry, displayNameOverride: event.target.value } : entry))} className={input} /></label>
          <label className="text-sm text-slate-300">Sets<input type="number" min={1} max={12} required value={row.sets} onChange={(event) => rows((entries) => entries.map((entry, i) => i === index ? { ...entry, sets: event.target.value } : entry))} className={input} /></label>
          <label className="text-sm text-slate-300">Rest (seconds)<input type="number" min={0} max={600} placeholder="Default" value={row.restSeconds ?? ""} onChange={(event) => rows((entries) => entries.map((entry, i) => i === index ? { ...entry, restSeconds: event.target.value } : entry))} className={input} /></label>
          <RepRangeEditor value={row.repRange} onChange={(repRange) => rows((entries) => entries.map((entry, i) => i === index ? { ...entry, repRange } : entry))} />
          <label className="text-sm text-slate-300">Superset with<select value={row.supersetGroupId ? (draft.exercises.findIndex((entry, i) => i !== index && entry.supersetGroupId === row.supersetGroupId)) : ""} onChange={(event) => rows((entries) => updateRoutineExerciseSuperset(entries, index, event.target.value === "" ? null : Number(event.target.value), trainingId))} className={input}><option value="">No superset</option>{draft.exercises.map((entry, i) => i === index ? null : <option key={entry.routineExerciseId} value={i}>{i + 1}. {name(entry)}</option>)}</select></label>
          <label className="text-sm text-slate-300 sm:col-span-2">Workout notes<textarea rows={2} value={row.note ?? ""} onChange={(event) => rows((entries) => entries.map((entry, i) => i === index ? { ...entry, note: event.target.value } : entry))} className={input} /></label>
          <div className="flex flex-wrap gap-2 sm:col-span-2"><button type="button" disabled={index === 0} aria-label={`Move ${name(row)} up`} className={button} onClick={() => rows((entries) => moveRoutineExercise(entries, index, -1))}>↑ Up</button><button type="button" disabled={index === draft.exercises.length - 1} aria-label={`Move ${name(row)} down`} className={button} onClick={() => rows((entries) => moveRoutineExercise(entries, index, 1))}>↓ Down</button><button type="button" className={button} onClick={() => setPicker({ swapIndex: index })}>Swap</button><button type="button" className={`${button} text-red-300`} onClick={() => rows((entries) => removeRoutineExercise(entries, index))}>Remove</button></div>
          <div className="sm:col-span-2">{renderMetadata(getExercise(row.exerciseId))}</div>
        </div>
      </details>)}
    </fieldset>
    {picker ? <TrainingExercisePicker exercises={draft.exercises} swapIndex={picker.swapIndex} onSelect={select} onClose={() => setPicker(null)} renderMetadata={renderMetadata} /> : null}
  </form>;
}
