"use client";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { act, fmt, useAppState, type State } from "../client";
import rules from "@/data/rules.json";

const day = (d: string) => d.slice(5).replace("-", "/");
const ALERT = { T01: "Emergency", T02: "Patient report: prompt review", report: "Pre-visit report ready", new_rx: "New prescription (photo)", missed_dose: "Missed dose", refill: "Medicine problem", question: "Patient question" } as const;
const KIND = { interaction: "Drug interaction", duplicate: "Duplicate ingredient", egfr_dose: "Kidney function (eGFR)" } as const;

// M08: built only from stored records, so every line traces back to data (no LLM, nothing invented).
function summary(s: State) {
  const days = [...new Set(s.doses.map((d) => d.date))].slice(-7);
  const doses = s.doses.filter((d) => days.includes(d.date) && d.taken_status !== "pending");
  const missed = doses.filter((d) => d.taken_status !== "taken");
  const sym = s.symptoms.filter((x) => days.includes(x.at.slice(0, 10)));
  const counts = Object.entries(Object.groupBy(sym, (x) => x.symptom_id)).map(([id, xs]) => `${s.symptomNames[id] ?? id} ×${xs!.length}`);
  const v = s.vitals.filter((x) => x.sbp);
  const e = s.patient.egfr;
  return [
    `Drug-related problems: ${s.flags.length} flags on the combined list from ${new Set(s.meds.map((m) => m.clinic)).size} sources (${s.flags.filter((f) => f.status === "new").length} not yet reviewed).`,
    `Adherence (7 days): ${doses.length - missed.length}/${doses.length} doses confirmed${missed.length ? `; missed ${missed.map((d) => `${day(d.date)} ${d.slot}`).join(", ")}` : ""}.`,
    `Symptoms reported (7 days): ${counts.join(", ") || "none"}${sym.some((x) => x.triage === "T02") ? "; one needs prompt review (T02)" : ""}.`,
    `BP ${v[0].sbp}/${v[0].dbp} → ${v.at(-1)!.sbp}/${v.at(-1)!.dbp} mmHg; weight ${s.vitals.find((x) => x.weightKg)!.weightKg} → ${s.vitals.findLast((x) => x.weightKg)!.weightKg} kg (patient/caregiver measured).`,
    `eGFR ${e[0].value} → ${e.at(-1)!.value} (${e[0].date} to ${e.at(-1)!.date}); creatinine ${s.patient.creatinine}; K+ ${s.patient.potassium.at(-1)!.value}.`,
  ];
}

export default function Doctor() {
  const s = useAppState();
  const [doses, setDoses] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [add, setAdd] = useState({ ingredient: "", dose: "", clinic: "Nephrology" });
  if (!s) return null;

  const dates = [...new Set(s.doses.map((d) => d.date))];
  const vitals = dates.map((d) => { const v = s.vitals.findLast((x) => x.at.startsWith(d)); return { d: day(d), sbp: v?.sbp ?? null, dbp: v?.dbp ?? null, kg: v?.weightKg ?? null }; });
  const week = dates.slice(-7).map((d) => ({ d: day(d), reports: s.symptoms.filter((x) => x.at.startsWith(d)).length }));
  const alerts = s.alerts.filter((a) => a.to.includes("doctor") && !a.ack);
  const active = s.meds.filter((m) => !m.stoppedAt);
  const med = (id: string) => s.meds.find((m) => m.id === id)!;
  const flagsOf = (id: string) => s.flags.filter((f) => f.medIds.includes(id));
  const egfr = s.patient.egfr.at(-1)!;

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-4 sm:px-8 py-4 flex flex-wrap justify-between items-center gap-x-6 gap-y-2">
        <div>
          <p className="text-xs uppercase tracking-wider text-sky-700 font-semibold">Dafe · Doctor · pre-visit AI report</p>
          <h1 className="text-xl font-semibold">{s.patient.name}, {s.patient.age} {s.patient.sex} · {s.patient.diagnoses.join(" · ")}</h1>
        </div>
        <a href="/report" target="_blank" className="rounded-lg border border-sky-700 px-3 py-1.5 text-sm font-medium text-sky-700">Pre-visit report{s.reportSentAt ? " (sent)" : ""}</a>
        <div className="text-right shrink-0">
          <p className="text-3xl font-semibold text-red-600">{egfr.value}</p>
          <p className="text-xs text-slate-500">eGFR mL/min/1.73m² · {egfr.date}</p>
        </div>
      </header>

      <div className="p-4 sm:p-8 grid xl:grid-cols-3 gap-6 [&>*]:min-w-0">
        <section className="xl:col-span-2">
          <h2 className="font-semibold text-lg">Drug-related problems (DRPs) for review <span className="ml-1 rounded-full bg-red-100 text-red-700 px-2 text-sm">{s.flags.filter((f) => f.status === "new").length} new</span></h2>
          <p className="text-sm text-slate-500">Explicit rules from the team&apos;s rule table, run on the combined list from all departments. The system flags; you decide.</p>
          {alerts.map((a) => (
            <div key={a.id} className={`mt-3 rounded-xl p-4 text-sm flex justify-between gap-3 ${a.kind === "T01" ? "bg-red-600 text-white" : "bg-amber-50 border border-amber-300"}`}>
              <span><b>{ALERT[a.kind]}</b> · {fmt(a.at)}<br />{a.text}{a.kind === "report" && <> <a href="/report" target="_blank" className="underline font-medium">Open report</a></>}</span>
              <button onClick={() => act({ type: "ack", id: a.id })} className="self-start shrink-0 rounded-lg border border-current px-3 py-1">Seen</button>
            </div>
          ))}
          {s.flags.map((f) => (
            <article key={f.id} className={`mt-3 rounded-xl border bg-white p-4 shadow-sm ${f.status === "new" ? "border-red-300" : "border-slate-200 opacity-75"}`}>
              <div className="flex justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-red-700">{KIND[f.kind]}{f.medIds.length > 2 ? " · three-drug combination" : ""}</p>
                  <h3 className="font-semibold">{f.title}</h3>
                </div>
                <span className={`shrink-0 self-start rounded-full px-2.5 py-0.5 text-xs font-medium ${f.status === "new" ? "bg-red-100 text-red-700" : "bg-slate-100"}`}>{f.status === "new" ? "New" : "Reviewed"}</span>
              </div>
              <ul className="mt-2 text-sm">
                {f.medIds.map(med).map((m) => (
                  <li key={m.id}><b>{m.ingredient}</b> {m.dose} · {m.slots.join(" + ") || "as needed"} · <span className="text-slate-500">{m.clinic}</span>{m.source === "patient_reported" && <span className="ml-1 text-amber-700">(reported by patient)</span>}</li>
                ))}
              </ul>
              <p className="mt-2 text-sm text-slate-700">{f.detail}</p>
              <p className="mt-1 text-xs text-slate-500">
                Prototype rule, requires clinical review · {f.source.startsWith("http") ? <a href={f.source} target="_blank" className="underline">source</a> : f.source}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <input value={notes[f.id] ?? f.note ?? ""} onChange={(e) => setNotes({ ...notes, [f.id]: e.target.value })} placeholder="Note (e.g. intended, stop ibuprofen)"
                  aria-label="Review note" className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm" />
                <button onClick={() => act({ type: "flag", id: f.id, status: "reviewed", note: notes[f.id] })} className="rounded-lg bg-sky-700 text-white px-3 text-sm font-medium">Mark reviewed</button>
              </div>
            </article>
          ))}
        </section>

        <div className="space-y-6">
          <section className="rounded-xl bg-white border border-slate-200 p-5">
            <h2 className="font-semibold">AI report <span className="text-xs font-normal text-slate-500">built only from recorded data</span></h2>
            <ul className="mt-2 space-y-1 text-sm list-disc pl-5">{summary(s).map((l) => <li key={l}>{l}</li>)}</ul>
          </section>
          <section className="rounded-xl bg-white border border-slate-200 p-5">
            <h2 className="font-semibold">eGFR trend <span className="text-xs font-normal text-red-600">dashed = 30</span></h2>
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={s.patient.egfr} margin={{ top: 10, right: 10, left: -20 }}>
                <CartesianGrid stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="date" tickFormatter={(d: string) => d.slice(0, 7)} fontSize={11} />
                <YAxis domain={[0, 60]} fontSize={11} />
                <ReferenceLine y={30} stroke="#dc2626" strokeDasharray="4 4" />
                <Tooltip />
                <Line isAnimationActive={false} dataKey="value" name="eGFR" stroke="#0369a1" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </section>
        </div>

        <section className="xl:col-span-2 rounded-xl bg-white border border-slate-200 p-5">
          <h2 className="font-semibold">Blood pressure and weight, 15 days <span className="text-xs font-normal text-slate-500">gaps = no reading</span></h2>
          <div className="grid md:grid-cols-2 gap-4">
            <ResponsiveContainer width="100%" height={190}>
              <LineChart data={vitals} margin={{ top: 10, right: 10, left: -20 }}>
                <CartesianGrid stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="d" fontSize={11} interval={2} />
                <YAxis domain={[60, 170]} fontSize={11} />
                <ReferenceLine y={rules.thresholds.sbpBelow} stroke="#f59e0b" strokeDasharray="4 4" />
                <Tooltip />
                <Line isAnimationActive={false} dataKey="sbp" name="Systolic" stroke="#be123c" strokeWidth={2} />
                <Line isAnimationActive={false} dataKey="dbp" name="Diastolic" stroke="#fb7185" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
            <ResponsiveContainer width="100%" height={190}>
              <LineChart data={vitals} margin={{ top: 10, right: 10, left: -20 }}>
                <CartesianGrid stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="d" fontSize={11} interval={2} />
                <YAxis domain={[56, 62]} fontSize={11} />
                <Tooltip />
                <Line isAnimationActive={false} dataKey="kg" name="Weight kg" stroke="#0f766e" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-xl bg-white border border-slate-200 p-5">
          <h2 className="font-semibold">Symptom reports, 7 days</h2>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={week} margin={{ top: 10, right: 10, left: -25 }}>
              <XAxis dataKey="d" fontSize={11} />
              <YAxis allowDecimals={false} fontSize={11} />
              <Tooltip />
              <Bar isAnimationActive={false} dataKey="reports" name="Reports" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <ul className="mt-2 text-sm space-y-0.5">
            {s.symptoms.slice(-4).reverse().map((x) => (
              <li key={x.at + x.symptom_id}>{fmt(x.at)} · {s.symptomNames[x.symptom_id] ?? x.symptom_id}
                {x.onset_relation && ` · ${x.onset_relation.replace("_", " ")}`}
                {x.severity_demo ? ` · severity ${x.severity_demo}/4` : ""}{x.activity_interference_demo !== undefined ? ` · activity ${x.activity_interference_demo}/3` : ""}
                {x.severity_demo || x.activity_interference_demo !== undefined ? " (demo scales)" : ""}
                {x.symptom_trend && ` · ${x.symptom_trend} vs yesterday`}{x.perceived_drug_relation && ` · thinks drug-related: ${x.perceived_drug_relation}`}
                {x.consulted_clinician !== undefined && ` · consulted clinician: ${x.consulted_clinician ? "yes" : "no"}`}
                {x.rule_answers.map((c) => ` · ${c.rule_id}: ${c.answer}`)}{x.triage && x.triage !== "T03" && <b className="text-amber-700"> · {x.triage}</b>}</li>
            ))}
          </ul>
        </section>

        <section className="xl:col-span-3 rounded-xl bg-white border border-slate-200 p-5">
          <div className="flex flex-wrap justify-between items-center gap-3">
            <div>
              <h2 className="font-semibold">Medication list <span className="text-xs font-normal text-slate-500">mirrors prescriptions issued in the hospital system; edit during the visit</span></h2>
              <p className="text-xs text-slate-500">{s.medsConfirmedAt ? `Confirmed ${fmt(s.medsConfirmedAt)}` : "Not yet confirmed"}{s.medChanges.length ? ` · changes this visit: ${s.medChanges.map((c) => c.detail).join("; ")}` : ""}</p>
            </div>
            <button onClick={() => act({ type: "confirmMeds" })} className="rounded-lg bg-sky-700 text-white px-4 py-2 text-sm font-medium">Confirm list</button>
          </div>
          <div className="overflow-x-auto"><table className="mt-3 w-full min-w-[640px] text-sm">
            <thead className="text-left text-xs text-slate-500"><tr><th className="py-1">Medicine</th><th>Class</th><th>Dose</th><th>When</th><th>Prescribed by</th><th>Flags</th><th></th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {active.map((m) => (
                <tr key={m.id}>
                  <td className="py-1.5 font-medium">{m.ingredient}{m.source !== "imported" && <span className="ml-1 text-xs text-amber-700">({m.source.replace("_", " ")})</span>}</td>
                  <td className="text-xs text-slate-500">{s.drugClasses[m.ingredient] ?? ""}</td>
                  <td><input value={doses[m.id] ?? m.dose} onChange={(e) => setDoses({ ...doses, [m.id]: e.target.value })} aria-label={`${m.ingredient} dose`} className="w-24 rounded border border-slate-200 px-2 py-0.5" />
                    {doses[m.id] && doses[m.id] !== m.dose && <button onClick={() => act({ type: "medDose", id: m.id, dose: doses[m.id] })} className="ml-1 text-sky-700 underline">save</button>}</td>
                  <td>{m.slots.join(" + ") || "as needed"}</td>
                  <td className="text-slate-500">{m.clinic}</td>
                  <td className="text-red-600 text-xs">{flagsOf(m.id).map((f) => KIND[f.kind]).join(", ")}</td>
                  <td className="text-right"><button onClick={() => act({ type: "medStop", id: m.id })} className="text-slate-500 hover:text-red-600 underline">stop</button></td>
                </tr>
              ))}
            </tbody>
          </table></div>
          <form className="mt-3 flex flex-wrap gap-2 text-sm" onSubmit={(e) => { e.preventDefault(); act({ type: "medAdd", ...add, slots: ["morning"], instructions: "Added during visit" }); setAdd({ ...add, ingredient: "", dose: "" }); }}>
            <input required list="ingredients" value={add.ingredient} onChange={(e) => setAdd({ ...add, ingredient: e.target.value })} placeholder="Add medicine (ingredient)" aria-label="New medicine" className="rounded border border-slate-300 px-2 py-1" />
            <datalist id="ingredients">{Object.keys(s.drugClasses).sort().map((i) => <option key={i} value={i} />)}</datalist>
            <input required value={add.dose} onChange={(e) => setAdd({ ...add, dose: e.target.value })} placeholder="Dose" aria-label="New dose" className="w-24 rounded border border-slate-300 px-2 py-1" />
            <select value={add.clinic} onChange={(e) => setAdd({ ...add, clinic: e.target.value })} aria-label="Prescribing department" className="rounded border border-slate-300 px-2 py-1">
              {["Nephrology", "Endocrinology", "Orthopedics"].map((c) => <option key={c}>{c}</option>)}
            </select>
            <button className="rounded border border-sky-700 text-sky-700 px-3">Add and check</button>
          </form>
        </section>
      </div>
    </main>
  );
}
