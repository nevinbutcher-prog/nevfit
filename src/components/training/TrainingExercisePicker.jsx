import { useEffect, useState } from "react";
import { searchExercises } from "../../services/exerciseProvider.js";
import { NEVFIT_EXERCISES } from "../../services/nevfitCatalogue.js";
import { TrainingDialog, button, input, primary } from "./TrainingPrimitives.jsx";

const equipmentOptions = [...new Set(NEVFIT_EXERCISES.flatMap((exercise) => exercise.equipment))].sort();
const muscleOptions = [...new Set(NEVFIT_EXERCISES.map((exercise) => exercise.primaryMuscle).filter(Boolean))].sort();
export default function TrainingExercisePicker({ exercises, swapIndex, onSelect, onClose, renderMetadata }) {
  const [query, setQuery] = useState(""), [equipment, setEquipment] = useState("all"), [muscle, setMuscle] = useState("all");
  const [result, setResult] = useState({ status: "loading", exercises: [] }), [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      setResult({ status: "loading", exercises: [] });
      searchExercises(query, { equipment, muscle }).then(
        (found) => { if (active) setResult({ status: "ready", exercises: found }); },
        () => { if (active) setResult({ status: "error", exercises: [] }); },
      );
    }, 180);
    return () => { active = false; clearTimeout(timer); };
  }, [query, equipment, muscle, retry]);
  return <TrainingDialog title={swapIndex === null ? "Add exercises" : "Swap exercise"} onClose={onClose}>
    <label className="block text-sm font-semibold">Search catalogue<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") event.preventDefault(); }} placeholder="Exercise name or alias" className={input} /></label>
    <div className="my-3 grid grid-cols-2 gap-3">
      <label className="text-sm text-slate-300">Equipment<select className={input} value={equipment} onChange={(event) => setEquipment(event.target.value)}><option value="all">All equipment</option>{equipmentOptions.map((value) => <option key={value}>{value}</option>)}</select></label>
      <label className="text-sm text-slate-300">Muscle<select className={input} value={muscle} onChange={(event) => setMuscle(event.target.value)}><option value="all">All muscles</option>{muscleOptions.map((value) => <option key={value}>{value}</option>)}</select></label>
    </div>
    <div role="status" className="my-3 text-sm text-slate-400">{result.status === "loading" ? "Searching…" : result.status === "error" ? "Catalogue unavailable." : `${result.exercises.length} results`}</div>
    {result.status === "error" ? <button type="button" className={button} onClick={() => setRetry((value) => value + 1)}>Retry search</button> : null}
    <div className="space-y-2">{result.exercises.map((exercise) => {
      const added = exercises.some((entry, index) => entry.exerciseId === exercise.id && index !== swapIndex);
      return <article key={exercise.id} className="rounded-xl border border-slate-700 bg-slate-950 p-3">
        <div className="flex items-center justify-between gap-3"><div className="min-w-0"><h3 className="break-words font-semibold">{exercise.name}</h3><p className="text-xs text-slate-400">{exercise.primaryMuscle} · {exercise.equipment.join(", ")}</p></div><button type="button" disabled={added} onClick={() => onSelect(exercise)} className={`${primary} shrink-0`}>{added ? "Added" : swapIndex === null ? "Add" : "Select"}</button></div>
        <details className="mt-2 text-sm text-slate-300"><summary className="cursor-pointer py-1">Exercise details</summary><div className="mt-2">{renderMetadata(exercise)}</div></details>
      </article>;
    })}</div>
  </TrainingDialog>;
}
