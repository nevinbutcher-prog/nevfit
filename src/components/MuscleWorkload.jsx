import { useState } from "react";
import MuscleBodyMap from "./MuscleBodyMap";

const periods = [
  ["this-week", "This Week"], ["last-seven-days", "Last 7 Days"], ["last-week", "Last Week"],
];
const formatSets = (value) => Number.isInteger(value) ? String(value) : value.toFixed(1);
const formatDate = (date) => date.toLocaleDateString(undefined, { day: "numeric", month: "short" });

export default function MuscleWorkload({ report, period, onPeriodChange, onOpen, onBack, detailed = false, loading = false, error = false }) {
  const [selectedId, setSelectedId] = useState(null);
  const values = Object.fromEntries(report.groups.map((group) => [group.id, group.weightedSets]));
  const ranked = report.groups.filter((group) => group.weightedSets > 0);
  const displayed = detailed ? report.groups : ranked.slice(0, 8);
  const max = ranked[0]?.weightedSets ?? 0;
  const selected = report.groups.find((group) => group.id === selectedId);
  return <section className="min-w-0 rounded-2xl border border-slate-800 bg-slate-900/90 p-4 shadow-xl sm:p-6">
    {detailed ? <button type="button" onClick={onBack} className="mb-4 text-sm font-semibold text-emerald-300 hover:underline">← Dashboard</button> : null}
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-2xl font-bold sm:text-3xl">Muscle Workload</h2>
      <label className="sr-only" htmlFor={detailed ? "workload-period-detail" : "workload-period-dashboard"}>Reporting period</label>
      <select id={detailed ? "workload-period-detail" : "workload-period-dashboard"} value={period} onChange={(event) => onPeriodChange(event.target.value)}
        className="rounded-xl border border-slate-600 bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-100">
        {periods.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
      </select>
    </div>
    <p className="mt-2 text-sm text-slate-400">{formatDate(report.window.start)} – {formatDate(new Date(report.window.end.getTime() - 1))} · weighted sets from completed strength workouts</p>
    {loading ? <p className="mt-5 text-slate-300">Loading completed workouts…</p> : error ?
      <p className="mt-5 text-amber-200">Workout history could not be refreshed. These values may be incomplete.</p> :
      report.totalWorkingSets === 0 ? <p className="mt-6 rounded-xl border border-slate-700 p-5 text-slate-300">No completed strength sets in this period. Earlier training remains available through the period selector.</p> :
      <div className={`mt-5 grid items-start gap-3 sm:gap-5 ${detailed ? "lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]" : "grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]"}`}>
        <div className="flex items-center justify-center gap-2 rounded-xl bg-slate-950/50 p-2">
          <MuscleBodyMap orientation="front" values={values} selectedId={selectedId} onSelect={detailed ? setSelectedId : undefined} compact={!detailed} />
          <MuscleBodyMap orientation="back" values={values} selectedId={selectedId} onSelect={detailed ? setSelectedId : undefined} compact={!detailed} />
        </div>
        <div className="min-w-0 space-y-2" aria-label="Muscle group weighted sets">
          <p className="text-right text-xs text-slate-400">Weighted sets</p>
          {displayed.length ? displayed.map((group) => <button key={group.id} type="button"
            onClick={detailed ? () => setSelectedId(group.id) : onOpen}
            aria-expanded={detailed ? selectedId === group.id : undefined}
            className={`grid w-full grid-cols-[5rem_minmax(0,1fr)_1.5rem] items-center gap-1 rounded-lg px-1 py-1 text-left text-xs hover:bg-slate-800 sm:grid-cols-[6.5rem_minmax(0,1fr)_2rem] sm:gap-2 sm:text-sm ${selectedId === group.id ? "bg-slate-800" : ""}`}>
            <span className="truncate text-slate-200">{group.label}</span>
            <span className="h-3 overflow-hidden rounded-full bg-slate-700"><span className="block h-full rounded-full bg-gradient-to-r from-sky-400 to-emerald-400" style={{ width: `${max ? group.weightedSets / max * 100 : 0}%` }} /></span>
            <span className="text-right font-semibold">{formatSets(group.weightedSets)}</span>
          </button>) : <p className="text-sm text-slate-300">No sets can be attributed to a muscle group.</p>}
        </div>
      </div>}
    {report.unattributedSets > 0 && !loading ? <p className="mt-4 text-sm text-amber-100">{report.unattributedSets} completed sets have no muscle attribution, including retained legacy IDs or exercises without specific catalogue metadata.</p> : null}
    {detailed ? <>
      {selected ? <div className="mt-5 rounded-xl border border-slate-700 bg-slate-950/50 p-4">
        <h3 className="text-lg font-bold">{selected.label}</h3>
        <p className="mt-1 text-sm text-slate-300">{selected.completedSets} completed set contributions · {formatSets(selected.weightedSets)} weighted sets</p>
        {selected.exercises.length ? <ul className="mt-3 divide-y divide-slate-800">{selected.exercises.map((exercise) => <li key={`${exercise.id}:${exercise.name}`} className="flex justify-between gap-3 py-2 text-sm"><span>{exercise.name}</span><span className="shrink-0 text-slate-300">{exercise.completedSets} sets · {formatSets(exercise.weightedSets)} weighted</span></li>)}</ul> : <p className="mt-3 text-sm text-slate-400">No contributing exercises this period.</p>}
      </div> : <p className="mt-4 text-sm text-slate-400">Choose a muscle on either map or in the list to see its exercises.</p>}
      {report.unattributedExercises.length ? <details className="mt-4 text-sm text-slate-300"><summary className="cursor-pointer">Unattributed exercises ({report.unattributedSets} sets)</summary><ul className="mt-2 space-y-1">{report.unattributedExercises.map((exercise) => <li key={`${exercise.id}:${exercise.name}`}>{exercise.name} · {exercise.completedSets} sets</li>)}</ul></details> : null}
      <p className="mt-5 text-xs leading-5 text-slate-400">Each completed working set adds 1 to its primary group and 0.5 to each distinct secondary group. This is an estimate of training stimulus, not a measure of growth, adequacy or recovery. A new week changes the reporting window; history is retained.</p>
    </> : <button type="button" onClick={onOpen} className="mt-5 w-full rounded-xl border border-slate-600 px-4 py-3 font-semibold text-slate-100 hover:bg-slate-800">View Muscle Workload →</button>}
  </section>;
}
