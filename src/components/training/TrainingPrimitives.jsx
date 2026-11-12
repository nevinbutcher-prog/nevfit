import { useEffect, useId, useRef } from "react";

export const button = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-emerald-300";
export const primary = `${button} border-emerald-400 bg-emerald-400 text-slate-950 hover:border-emerald-300 hover:bg-emerald-300`;
export const input = "mt-1 min-h-11 w-full min-w-0 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-base text-white focus:border-emerald-400 focus:outline-none";

export function Icon({ name }) {
  return <img src={`/assets/training-icons/${name}.svg`} className="h-5 w-5 shrink-0" alt="" aria-hidden="true" />;
}
export function TrainingDialog({ title, onClose, busy, children }) {
  const ref = useRef(null), titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement;
    dialog.showModal();
    return () => { dialog.close(); previous?.focus(); };
  }, []);
  return <dialog ref={ref} aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}
    className="m-auto max-h-[90dvh] w-[calc(100%_-_1.5rem)] max-w-xl overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-4 text-white shadow-2xl backdrop:bg-slate-950/85 sm:p-6">
    <div className="mb-4 flex items-start justify-between gap-3"><h2 id={titleId} className="text-xl font-bold">{title}</h2><button type="button" onClick={onClose} disabled={busy} className={button} aria-label="Close dialog">Close</button></div>
    {children}
  </dialog>;
}
