import { useState } from "react";
import { normalizeRobCoachingProfile, parseRobProfileList } from "../../services/rob/robCoachingProfile.js";

const initialFields = (profile) => ({
  goals: profile.goals.join(", "), equipment: profile.equipment.join(", "), constraints: profile.constraints.join(", "),
  likes: profile.likes.join(", "), dislikes: profile.dislikes.join(", "), setting: profile.trainingStyle.setting ?? "",
  sessionMinutes: profile.trainingStyle.targetSessionMinutes ?? "", daysPerWeek: profile.trainingStyle.daysPerWeek ?? "",
  progressionMethod: profile.progression.method ?? "", progressionRule: profile.progression.rule ?? "",
});

export default function RobCoachingPreferences({ profile, onSave }) {
  const [fields, setFields] = useState(() => initialFields(profile));
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");
  const update = (name, value) => { setFields((current) => ({ ...current, [name]: value })); setStatus("idle"); };
  async function save(event) {
    event.preventDefault();
    setStatus("saving");
    setMessage("");
    try {
      const normalized = normalizeRobCoachingProfile({
        version: 1, goals: parseRobProfileList(fields.goals), equipment: parseRobProfileList(fields.equipment),
        constraints: parseRobProfileList(fields.constraints), likes: parseRobProfileList(fields.likes), dislikes: parseRobProfileList(fields.dislikes),
        trainingStyle: { setting: fields.setting, targetSessionMinutes: Number(fields.sessionMinutes) || null, daysPerWeek: Number(fields.daysPerWeek) || null },
        progression: { method: fields.progressionMethod || null, rule: fields.progressionMethod ? fields.progressionRule : null },
      });
      await onSave(normalized);
      setFields(initialFields(normalized));
      setStatus("saved");
      setMessage("Coaching preferences saved for this account.");
    } catch {
      setStatus("error");
      setMessage("Couldn't save coaching preferences. Try again.");
    }
  }
  const textField = (name, label, hint = "") => <label key={name} className="block text-sm font-semibold text-slate-200">{label}<input value={fields[name]} onChange={(event) => update(name, event.target.value)} maxLength={600} className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-white" />{hint ? <span className="mt-1 block text-xs font-normal text-slate-400">{hint}</span> : null}</label>;
  return <form onSubmit={save} className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-5">
    <p className="text-sm text-slate-300">Add what Rob should know about your training. Blank fields stay unknown. Separate multiple items with commas.</p>
    {textField("goals", "Goals and priorities")}
    {textField("equipment", "Available equipment")}
    {textField("constraints", "Training constraints")}
    {textField("likes", "Exercises you like")}
    {textField("dislikes", "Exercises you dislike")}
    {textField("setting", "Training setting", "For example, home gym or commercial gym.")}
    <div className="grid grid-cols-2 gap-3"><label className="text-sm font-semibold text-slate-200">Usual session minutes<input type="number" min="20" max="180" value={fields.sessionMinutes} onChange={(event) => update("sessionMinutes", event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-white" /></label><label className="text-sm font-semibold text-slate-200">Training days per week<input type="number" min="1" max="7" value={fields.daysPerWeek} onChange={(event) => update("daysPerWeek", event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-white" /></label></div>
    <label className="block text-sm font-semibold text-slate-200">Progression method<select value={fields.progressionMethod} onChange={(event) => update("progressionMethod", event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-white"><option value="">Not recorded</option><option value="double_progression">Double progression</option><option value="other">Another method</option></select></label>
    {fields.progressionMethod ? textField("progressionRule", "Your progression rule", "For double progression, describe when you increase weight within your rep range.") : null}
    {message ? <p role="status" className={status === "error" ? "text-sm text-amber-200" : "text-sm text-emerald-200"}>{message}</p> : null}
    <button type="submit" disabled={status === "saving"} className="rounded-lg bg-emerald-400 px-4 py-2 font-semibold text-slate-950 disabled:opacity-50">{status === "saving" ? "Saving…" : "Save preferences"}</button>
  </form>;
}
