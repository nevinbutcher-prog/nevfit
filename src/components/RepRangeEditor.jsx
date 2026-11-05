import { useId, useState } from "react";
import { MAX_EDITOR_REPS, parseEditorRepCount, parseEditorRepRange, updateEditorRepRange } from "../services/repRangeEditor.js";

function RepCountControl({ label, value, onChange }) {
  const id = useId();
  const [draft, setDraft] = useState(null);
  const invalid = draft !== null && parseEditorRepCount(draft) === null;
  const buttonClass = "h-11 w-11 shrink-0 rounded-lg border border-slate-600 text-xl text-white disabled:opacity-30";
  return <div className="min-w-0">
    <label htmlFor={id} className="text-xs text-slate-300">{label}</label>
    <div className="mt-1 flex min-w-0 items-center gap-1">
      <button type="button" aria-label={`Decrease ${label.toLowerCase()}`} disabled={value === null || value <= 1} onClick={() => { setDraft(null); onChange(value - 1); }} className={buttonClass}>−</button>
      <input id={id} type="text" inputMode="numeric" pattern="[0-9]*" value={draft ?? value ?? ""}
        onFocus={() => setDraft(value === null ? "" : String(value))}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          const count = parseEditorRepCount(draft);
          if (count !== null) onChange(count);
          setDraft(null);
        }}
        onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); event.currentTarget.blur(); } }}
        aria-invalid={invalid} aria-describedby={invalid ? `${id}-error` : undefined}
        className="h-11 w-full min-w-0 rounded-lg border border-slate-700 bg-slate-950 px-1 text-center text-base text-white" />
      <button type="button" aria-label={`Increase ${label.toLowerCase()}`} disabled={value >= MAX_EDITOR_REPS} onClick={() => { setDraft(null); onChange((value ?? 0) + 1); }} className={buttonClass}>+</button>
    </div>
    {invalid ? <p id={`${id}-error`} className="mt-1 text-xs text-amber-200">Use a whole number from 1 to {MAX_EDITOR_REPS}. Leaving this field restores the last valid value.</p> : null}
  </div>;
}

export default function RepRangeEditor({ value, onChange }) {
  const range = parseEditorRepRange(value);
  function update(bound, count) {
    const next = updateEditorRepRange(value, bound, count);
    if (next !== null) onChange(next);
  }
  return <fieldset className="min-w-0">
    <legend className="text-sm font-semibold text-slate-300">Reps</legend>
    <div className="mt-1 space-y-2">
      <RepCountControl label="Min reps" value={range?.min ?? null} onChange={(count) => update("min", count)} />
      <RepCountControl label="Max reps" value={range?.max ?? null} onChange={(count) => update("max", count)} />
    </div>
    <p className="mt-2 text-sm text-slate-200">{range ? range.min === range.max ? `${range.min} reps` : `${range.min}–${range.max} reps` : `Stored value: ${value || "(empty)"}. Set either number to replace it.`}</p>
    <p className="mt-1 text-xs text-slate-400">Crossing a bound moves the other with it.</p>
  </fieldset>;
}
