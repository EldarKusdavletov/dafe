"use client";
import { fmt, useAppState } from "../client";

// Clinic-visit scenario (team Doc): a report for the doctor, "not chatting style, AI report style".
// Every line is read from stored records; nothing is generated, so nothing can be hallucinated or dropped.
const KIND = { interaction: "Drug interaction", duplicate: "Duplicate ingredient", egfr_dose: "Kidney function (eGFR)" } as const;
const day = (d: string) => d.slice(5).replace("-", "/");

function H({ n, children }: { n: number; children: React.ReactNode }) {
  return <h2 className="mt-8 mb-2 border-b border-slate-300 pb-1 text-sm font-bold uppercase tracking-wider text-slate-700">{n}. {children}</h2>;
}

export default function Report() {
  const s = useAppState();
  if (!s) return null;

  const days = [...new Set(s.doses.map((d) => d.date))];
  const week = days.slice(-7);
  const doses = s.doses.filter((d) => week.includes(d.date) && d.taken_status !== "pending");
  const missed = doses.filter((d) => d.taken_status !== "taken");
  const symptoms = s.symptoms.filter((x) => days.includes(x.at.slice(0, 10)));
  const vitals = s.vitals.filter((v) => v.sbp);
  const kg = s.vitals.filter((v) => v.weightKg);
  const active = s.meds.filter((m) => !m.stoppedAt);
  const med = (id: string) => s.meds.find((m) => m.id === id)!;
  const decide = [
    ...s.flags.filter((f) => f.status === "new").map((f) => `${KIND[f.kind]}: ${f.title}`),
    ...symptoms.filter((x) => x.triage === "T02" || x.triage === "T01").map((x) => `Assess ${s.symptomNames[x.symptom_id] ?? x.symptom_id} reported ${fmt(x.at)} (${x.triage})`),
    ...(missed.length ? [`Adherence: ${missed.length} missed doses in 7 days`] : []),
  ];

  return (
    <main className="mx-auto w-full max-w-3xl bg-white px-6 py-10 sm:px-12 text-slate-900 min-h-screen">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-slate-900 pb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-teal-700">Dafe · pre-visit report</p>
          <h1 className="mt-1 text-2xl font-bold">{s.patient.name}, {s.patient.age} {s.patient.sex}</h1>
          <p className="text-sm text-slate-600">{s.patient.diagnoses.join(" · ")}</p>
        </div>
        <div className="text-right text-sm text-slate-600">
          <p>Prepared {fmt(s.now)}</p>
          <p>Period {day(days[0])} to {day(days.at(-1)!)}</p>
          <p className={s.reportSentAt ? "font-semibold text-teal-700" : ""}>{s.reportSentAt ? `Sent to doctor ${fmt(s.reportSentAt)}` : "Not sent yet"}</p>
        </div>
      </header>
      <p className="mt-3 text-xs text-slate-500">Compiled from patient, caregiver and prescription records. Patient reports are not confirmed adverse events. Flags come from the team&apos;s rule table and need clinical review.</p>

      <H n={1}>For the doctor to decide</H>
      <ol className="list-decimal pl-6 space-y-1 text-sm">{decide.length ? decide.map((d) => <li key={d}>{d}</li>) : <li>Nothing flagged.</li>}</ol>

      <H n={2}>Drug-related problems</H>
      {s.flags.map((f) => (
        <div key={f.id} className="mb-3 text-sm">
          <p><b>{KIND[f.kind]}:</b> {f.title} <span className="text-slate-500">({f.status === "new" ? "not yet reviewed" : "reviewed"}{f.note ? `; note: ${f.note}` : ""})</span></p>
          <p className="text-slate-700">{f.medIds.map(med).map((m) => `${m.ingredient} ${m.dose} (${m.clinic})`).join(" + ")}</p>
          <p className="text-slate-500">{f.detail}</p>
        </div>
      ))}

      <H n={3}>Current medicines ({active.length}, from {new Set(active.map((m) => m.clinic)).size} sources)</H>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead className="text-left text-xs text-slate-500"><tr><th className="py-1">Medicine</th><th>Dose</th><th>When</th><th>Source</th></tr></thead>
          <tbody className="divide-y divide-slate-200">
            {active.map((m) => (
              <tr key={m.id}><td className="py-1 font-medium">{m.ingredient}</td><td>{m.dose}</td><td>{m.slots.join(" + ") || "as needed"}</td>
                <td className="text-slate-600">{m.clinic}{m.source !== "imported" && ` (${m.source.replace("_", " ")})`}</td></tr>
            ))}
          </tbody>
        </table>
      </div>

      <H n={4}>Adherence, last 7 days</H>
      <p className="text-sm">{doses.length - missed.length} of {doses.length} scheduled doses confirmed{missed.length ? `. Missed: ${missed.map((d) => `${day(d.date)} ${d.slot}${d.missed_reason ? ` (${d.missed_reason.replace("_", " ")})` : ""}`).join(", ")}` : ""}.</p>

      <H n={5}>Patient-reported symptoms</H>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead className="text-left text-xs text-slate-500"><tr><th className="py-1">When</th><th>Symptom</th><th>Onset</th><th>Severity / activity</th><th>Trend</th><th>Level</th></tr></thead>
          <tbody className="divide-y divide-slate-200">
            {symptoms.map((x) => (
              <tr key={x.at + x.symptom_id}>
                <td className="py-1">{fmt(x.at)}</td><td>{s.symptomNames[x.symptom_id] ?? x.symptom_id}</td>
                <td>{x.onset_relation?.replace("_", " ") ?? "–"}</td>
                <td>{x.severity_demo ? `${x.severity_demo}/4` : "–"}{x.activity_interference_demo !== undefined ? ` · ${x.activity_interference_demo}/3` : ""}</td>
                <td>{x.symptom_trend ?? "–"}</td><td className={x.triage !== "T03" ? "font-semibold text-amber-700" : ""}>{x.triage}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-1 text-xs text-slate-500">Severity 1–4 and activity 0–3 are development-only scales.</p>

      <H n={6}>Measurements and labs</H>
      <ul className="text-sm space-y-1">
        <li>Blood pressure {vitals[0].sbp}/{vitals[0].dbp} → {vitals.at(-1)!.sbp}/{vitals.at(-1)!.dbp} mmHg ({vitals.length} readings, patient or caregiver measured)</li>
        <li>Weight {kg[0].weightKg} → {kg.at(-1)!.weightKg} kg</li>
        <li>eGFR {s.patient.egfr.map((e) => `${e.value} (${e.date.slice(0, 7)})`).join(" → ")} · creatinine {s.patient.creatinine} · K+ {s.patient.potassium.at(-1)!.value}</li>
      </ul>

      <H n={7}>Caregiver notes</H>
      <ul className="text-sm space-y-1">{s.reports.slice(0, 3).map((r) => <li key={r.at}>{fmt(r.at)}: {r.note || r.issues.join(", ")}</li>)}</ul>

      <p className="mt-10 border-t border-slate-200 pt-3 text-xs text-slate-500">Dafe never diagnoses or changes doses. It checks, records and forwards. The doctor decides.</p>
    </main>
  );
}
