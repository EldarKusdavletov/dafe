import { readFileSync } from "node:fs";
import { join } from "node:path";
import seed from "@/data/seed.json";
import rulesFile from "@/data/rules.json";
import questions from "@/data/questions.json";
import { parseCsv } from "./csv";
import type { RxDrug } from "./extract";
import { classOf, evaluate, parseRules, type EgfrRule, type Flag, type InteractionRule, type Med } from "./rules";

export type Slot = "morning" | "evening";
export type Lang = "en" | "ko";
export type Dose = {
  date: string; slot: Slot; reminders: number;
  taken_status: "pending" | "taken" | "not_taken" | "unsure" | "missed";
  reported_at?: string; actual_dose_time?: string; missed_reason?: string;
};
export type Symptom = {
  // Field names follow sheet tab 03 (A04–A10).
  at: string; symptom_id: string; onset_relation?: string; severity_demo?: number; activity_interference_demo?: number;
  symptom_trend?: string; perceived_drug_relation?: string; consulted_clinician?: boolean;
  rule_answers: { rule_id: string; answer: string }[];
  triage?: "T01" | "T02" | "T03"; patient_reported: true;
};
export type Vital = { at: string; sbp?: number; dbp?: number; weightKg?: number; glucose?: number; source: "patient" | "caregiver" };
export type Alert = { id: string; kind: "missed_dose" | "T01" | "T02" | "refill" | "report" | "new_rx" | "question"; to: ("caregiver" | "doctor")[]; text: string; at: string; ack: boolean };
export type State = {
  now: string; lang: Lang; useLLM: boolean; fullCheckin: boolean;
  patient: typeof seed.patient;
  meds: Med[]; doses: Dose[]; symptoms: Symptom[]; vitals: Vital[]; flags: Flag[]; alerts: Alert[];
  medChanges: { at: string; medId: string; change: "add" | "stop" | "dose"; detail: string }[];
  reports: { at: string; taken: boolean; issues: string[]; note: string }[];
  transcript: { at: string; who: "ai" | "patient"; text: string; by?: string }[];
  dialog: { slot?: Slot; current: string | null; queue: string[]; flagged: false | "caregiver" | "doctor"; pending_rx?: RxDrug[] };
  reportSentAt?: string; // clinic-visit scenario: pre-visit report sent to the doctor
  lastReminderAt?: number; // real ms; silence windows run on wall-clock, not the demo clock
  medsConfirmedAt?: string;
  // From the team's sheets (data/team), for labels on the screens.
  symptomNames: Record<string, string>; drugClasses: Record<string, string>;
};

export const local = rulesFile as { egfrRules: EgfrRule[]; thresholds: { sbpBelow: number; sbpAbove: number; weightGainKg3d: number } };
export const SILENCE_MS = 20_000; // demo window; real product: 30 min

// The team's sheets, synced by scripts/sync-team-data.sh, are the database: re-read on every reset.
const teamCsv = (file: string) => parseCsv(readFileSync(join(process.cwd(), "data/team", file), "utf8"));

const DAYS = Array.from({ length: 14 }, (_, i) => `2026-10-${String(11 + i).padStart(2, "0")}`);
// Invented history ending near patient A's documented BP 138/82 (see seed.json _source).
const SBP = [140, 138, 141, 137, 139, 136, 138, 135, 133, 130, 128, 126, 124, 121];
const DBP = [84, 82, 85, 82, 83, 81, 82, 80, 79, 77, 76, 75, 74, 72];
const KG = [58.0, 58.1, 58.0, 58.2, 58.3, 58.2, 58.4, 58.5, 58.6, 58.8, 58.9, 59.1, 59.4, 59.8];

type SheetQuestion = { en: string; ko: string; options: string };
const g = globalThis as unknown as { pharmState?: State; pharmRules?: InteractionRule[]; pharmQuestions?: Record<string, SheetQuestion> };

function fresh(): State {
  g.pharmRules = parseRules(teamCsv("en/05_Drug_Class_Assessment.csv"));
  const ko = new Map(teamCsv("ko/03_공통사정.csv").map((r) => [r["문항ID"], r["환자 질문(개발용)"]]));
  g.pharmQuestions = Object.fromEntries(teamCsv("en/03_Core_Assessment.csv").map((r) =>
    [r["Item ID"], { en: r["Patient Question (Development Draft)"], ko: ko.get(r["Item ID"]) ?? r["Patient Question (Development Draft)"], options: r["Options / Range"] }]));
  const s: State = {
    now: "2026-10-25T07:55", lang: "en", useLLM: true, fullCheckin: false,
    patient: structuredClone(seed.patient),
    meds: seed.meds.map((m) => ({ ...m, slots: m.slots as Slot[], source: "imported" as const })),
    doses: DAYS.flatMap((date) => (["morning", "evening"] as Slot[]).map((slot): Dose => {
      const missed = (date === "2026-10-18" || date === "2026-10-21") && slot === "evening";
      return { date, slot, reminders: missed ? 2 : 1, taken_status: missed ? "missed" : "taken", missed_reason: date === "2026-10-18" && missed ? "forgot" : undefined };
    })),
    // Two days without readings so the trend shows gaps, not zeros (M07).
    vitals: DAYS.flatMap((d, i) => d.endsWith("15") || d.endsWith("19") ? [] : [{ at: `${d}T08:10`, sbp: SBP[i], dbp: DBP[i], weightKg: KG[i], source: i % 2 ? "caregiver" as const : "patient" as const }]),
    symptoms: [
      { at: "2026-10-16T08:05", symptom_id: "S01", severity_demo: 1, rule_answers: [], triage: "T03", patient_reported: true },
      { at: "2026-10-20T08:05", symptom_id: "S07", severity_demo: 1, rule_answers: [], triage: "T03", patient_reported: true },
      { at: "2026-10-23T08:05", symptom_id: "S07", severity_demo: 2, rule_answers: [], triage: "T03", patient_reported: true },
    ],
    reports: [
      { at: "2026-10-20T15:00", taken: true, issues: ["Dizziness"], note: "Took all meds. Mild dizziness when getting up from the sofa." },
      { at: "2026-10-23T15:00", taken: true, issues: ["Knee pain"], note: "Knee pain; using the ibuprofen from orthopedics twice a day." },
    ],
    flags: [], alerts: [], medChanges: [], transcript: [],
    dialog: { current: null, queue: [], flagged: false },
    symptomNames: Object.fromEntries(teamCsv("en/04_CKD_Symptoms.csv").map((r) => [r["Symptom ID"], r["Symptom Domain"]])),
    drugClasses: Object.fromEntries(classOf(g.pharmRules)),
  };
  s.flags = reevaluate(s);
  return s;
}

export const getState = () => (g.pharmState ??= fresh());
export const reset = () => (g.pharmState = fresh());

export const latestEgfr = (s: State) => s.patient.egfr.at(-1)!.value;
export const reevaluate = (s: State) => evaluate(s.meds, latestEgfr(s), g.pharmRules ?? [], local.egfrRules, s.flags);
export const todayDose = (s: State, slot = s.dialog.slot) => s.doses.find((d) => d.date === s.now.slice(0, 10) && d.slot === slot);

// Line keys: questions.json (script and local lines) first, then the sheet's tab-03 questions (A02, A06–A10);
// "FLAG:<flag id>" asks that rule's patient question from the team's rule table.
export function line(s: State, key: string, slot?: Slot, drug = "") {
  if (key.startsWith("FLAG:")) return s.flags.find((f) => f.id === key.slice(5))?.question ?? "";
  const local = (questions as unknown as Record<string, { en: string; ko: string }>)[key];
  const sheet = g.pharmQuestions?.[key];
  // Rating items (A06 1–4, A07 0–3) get their range read out so the answer can be spoken.
  const range = sheet?.options.match(/(\d)\s*[–~-]\s*(\d)/);
  const hint = range ? (s.lang === "ko" ? ` ${range[1]}에서 ${range[2]} 사이로 말씀해 주세요.` : ` Please answer from ${range[1]} to ${range[2]}.`) : "";
  const text = local ? local[s.lang] : sheet ? sheet[s.lang] + hint : key;
  const fill = (k: "slot" | "greeting") => (slot ? questions[k][slot][s.lang] : "");
  const out = text.replace("{slot}", fill("slot")).replace("{greeting}", fill("greeting")).replace("{name}", s.patient.callName[s.lang]).replaceAll("{drug}", drug);
  return out.charAt(0).toUpperCase() + out.slice(1); // "{drug} may affect…" starts a sentence
}
export function say(s: State, key: string, slot?: Slot, drug?: string) {
  s.transcript.push({ at: s.now, who: "ai", text: line(s, key, slot, drug) });
}
export function alert(s: State, kind: Alert["kind"], to: Alert["to"], text: string) {
  s.alerts.unshift({ id: `a${Date.now()}${s.alerts.length}`, kind, to, text, at: s.now, ack: false });
}

// Called on every poll: re-remind once, then mark missed and alert the caregiver.
export function tick(s: State) {
  const dose = todayDose(s);
  if (!dose || dose.taken_status !== "pending" || !s.lastReminderAt || Date.now() - s.lastReminderAt < SILENCE_MS) return;
  if (dose.reminders < 2) {
    dose.reminders++;
    s.lastReminderAt = Date.now();
    say(s, "reminder2", dose.slot);
  } else {
    dose.taken_status = "missed";
    s.lastReminderAt = undefined;
    s.dialog = { current: null, queue: [], flagged: false };
    alert(s, "missed_dose", ["caregiver"], `No answer to 2 ${dose.slot} reminders: ${dose.slot} dose not confirmed.`);
  }
}
