"use client";
import { useState } from "react";
import { act, fmt, useAppState } from "../client";

const ISSUES = ["Dizziness", "Low appetite", "Swelling", "Knee pain", "Refused medicine", "Out of medicine"];

export default function Caregiver() {
  const s = useAppState();
  const [taken, setTaken] = useState(true);
  const [issues, setIssues] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [bp, setBp] = useState("");
  const [kg, setKg] = useState("");
  const [sent, setSent] = useState(false);
  if (!s) return null;

  const today = s.now.slice(0, 10);
  const alerts = s.alerts.filter((a) => a.to.includes("caregiver"));
  const days = [...new Set(s.doses.map((d) => d.date))].slice(-7);
  const lastSymptom = s.symptoms.at(-1);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const [sbp, dbp] = bp.split("/").map(Number);
    await act({ type: "report", taken, issues, note, ...(sbp && dbp && { sbp, dbp }), ...(Number(kg) && { weightKg: Number(kg) }) });
    setIssues([]); setNote(""); setBp(""); setKg(""); setSent(true);
    setTimeout(() => setSent(false), 2500);
  }

  return (
    <main className="mx-auto w-full max-w-md min-h-screen bg-slate-50 pb-10">
      <header className="bg-teal-700 text-white px-5 pt-6 pb-5 rounded-b-3xl">
        <p className="text-teal-100 text-sm">Caring for</p>
        <h1 className="text-2xl font-semibold">{s.patient.name}</h1>
        <p className="text-teal-100 text-sm">{s.patient.age} · {s.patient.home} · {s.meds.filter((m) => !m.stoppedAt).length} medicines from {new Set(s.meds.map((m) => m.clinic)).size} departments</p>
      </header>

      <section className="px-4 mt-4 space-y-3" aria-live="polite">
        {alerts.length === 0 && <p className="text-slate-500 text-sm px-1">No alerts. All good.</p>}
        {alerts.map((a) => (
          <div key={a.id} className={`rounded-2xl p-4 shadow-sm border ${a.ack ? "bg-white border-slate-200 opacity-60" : a.kind === "T01" ? "bg-red-600 text-white border-red-700" : "bg-amber-50 border-amber-300"}`}>
            <div className="flex justify-between items-start gap-3">
              <div>
                <p className="font-semibold">{a.kind === "missed_dose" ? "Missed dose" : a.kind === "T01" ? "Emergency" : a.kind === "refill" ? "Medicine problem" : "Symptom alert"}</p>
                <p className="text-sm mt-1">{a.text}</p>
                <p className="text-xs mt-1 opacity-70">{fmt(a.at)}</p>
              </div>
              {!a.ack && <button onClick={() => act({ type: "ack", id: a.id })} className="shrink-0 rounded-full bg-white/90 text-slate-900 border border-slate-300 px-3 py-1 text-sm font-medium">OK</button>}
            </div>
          </div>
        ))}
      </section>

      <section className="mx-4 mt-5 rounded-2xl bg-white p-4 shadow-sm border border-slate-200">
        <h2 className="font-semibold">Today</h2>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {(["morning", "evening"] as const).map((slot) => {
            const d = s.doses.find((x) => x.date === today && x.slot === slot);
            const st = d?.taken_status ?? "upcoming";
            return (
              <div key={slot} className={`rounded-xl p-3 text-sm ${st === "taken" ? "bg-emerald-50 text-emerald-800" : st === "missed" || st === "not_taken" ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-600"}`}>
                <p className="capitalize font-medium">{slot}</p>
                <p>{st === "pending" ? `Waiting (reminder ${d!.reminders})` : st.replace("_", " ")}</p>
              </div>
            );
          })}
        </div>
        {lastSymptom?.at.startsWith(today) && <p className="mt-3 text-sm text-amber-800">Reported today: {s.symptomNames[lastSymptom.symptom_id] ?? lastSymptom.symptom_id}</p>}
        <p className="mt-4 text-xs text-slate-500">Last 7 days</p>
        <div className="mt-1 flex gap-1.5">
          {days.map((day) => (
            <div key={day} className="flex-1 text-center">
              <div className="flex flex-col gap-0.5">
                {s.doses.filter((d) => d.date === day).map((d) => (
                  <span key={d.slot} title={`${day} ${d.slot}: ${d.taken_status}`} className={`h-2.5 rounded-full ${d.taken_status === "taken" ? "bg-emerald-500" : d.taken_status === "pending" ? "bg-slate-300" : "bg-red-500"}`} />
                ))}
              </div>
              <span className="text-[10px] text-slate-500">{day.slice(8)}</span>
            </div>
          ))}
        </div>
      </section>

      <form onSubmit={submit} className="mx-4 mt-5 rounded-2xl bg-white p-4 shadow-sm border border-slate-200 space-y-3">
        <h2 className="font-semibold">Visit report <span className="text-xs font-normal text-slate-500">medication-focused</span></h2>
        <fieldset className="flex gap-2">
          <legend className="text-sm text-slate-600 mb-1">Medicines taken during visit?</legend>
          {[true, false].map((v) => (
            <button type="button" key={String(v)} onClick={() => setTaken(v)} aria-pressed={taken === v}
              className={`flex-1 rounded-xl py-2 text-sm font-medium border ${taken === v ? "bg-teal-700 text-white border-teal-700" : "border-slate-300"}`}>{v ? "Yes" : "No"}</button>
          ))}
        </fieldset>
        <div className="flex flex-wrap gap-2">
          {ISSUES.map((i) => (
            <button type="button" key={i} aria-pressed={issues.includes(i)} onClick={() => setIssues(issues.includes(i) ? issues.filter((x) => x !== i) : [...issues, i])}
              className={`rounded-full px-3 py-1 text-sm border ${issues.includes(i) ? "bg-amber-100 border-amber-400" : "border-slate-300"}`}>{i}</button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input value={bp} onChange={(e) => setBp(e.target.value)} placeholder="BP e.g. 128/76" aria-label="Blood pressure" className="rounded-xl border border-slate-300 px-3 py-2 text-sm" />
          <input value={kg} onChange={(e) => setKg(e.target.value)} placeholder="Weight kg" inputMode="decimal" aria-label="Weight in kg" className="rounded-xl border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" aria-label="Note" rows={2} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
        <button className="w-full rounded-xl bg-teal-700 text-white py-2.5 font-medium">{sent ? "Sent ✓" : "Send report"}</button>
      </form>

      <section className="mx-4 mt-5">
        <h2 className="font-semibold px-1">Recent reports</h2>
        {s.reports.slice(0, 3).map((r) => (
          <div key={r.at} className="mt-2 rounded-xl bg-white border border-slate-200 p-3 text-sm">
            <p className="text-xs text-slate-500">{fmt(r.at)} · {r.taken ? "meds taken" : "meds NOT taken"}{r.issues.length ? ` · ${r.issues.join(", ")}` : ""}</p>
            {r.note && <p className="mt-1">{r.note}</p>}
          </div>
        ))}
      </section>
    </main>
  );
}
