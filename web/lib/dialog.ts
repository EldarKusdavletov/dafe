import type { Extraction, RxDrug } from "./extract";
import { alert, line, reevaluate, say, todayDose, type Slot, type State, type Symptom } from "./store";

// The check-in follows the team's tables: sheet tab 03 (A01–A10 and their conditions), tab 05 (the matched
// rule's patient question) and tab 06 (T01 emergency / T02 prompt consultation / T03 monitor).
// Default = Hajin's short morning script (A01 → A04 → A05 → rule question); fullCheckin adds A02 and A06–A10.
export function fireSlot(s: State, slot: Slot) {
  s.now = `${s.now.slice(0, 10)}T${slot === "morning" ? "08:00" : "20:00"}`;
  s.doses = s.doses.filter((d) => !(d.date === s.now.slice(0, 10) && d.slot === slot));
  s.doses.push({ date: s.now.slice(0, 10), slot, reminders: 1, taken_status: "pending" });
  s.dialog = { slot, current: "A01", queue: [], flagged: false };
  s.lastReminderAt = Date.now();
  say(s, "reminder", slot);
  say(s, "A01", slot);
}

export const currentQuestion = (s: State) => (s.dialog.current ? line(s, s.dialog.current, s.dialog.slot) : "(no question pending)");

// The rule question to ask after a symptom: triples first, then pairs (duplicates and eGFR flags have none).
const ruleQuestion = (s: State) => s.flags.filter((f) => f.question).sort((a, b) => b.medIds.length - a.medIds.length)[0];

// Tab 06 T02: advise prompt consultation and record; the doctor and caregiver are alerted.
function escalate(s: State, sym: Symptom, why: string) {
  sym.triage = "T02";
  alert(s, "T02", ["doctor", "caregiver"], `${s.symptomNames[sym.symptom_id] ?? sym.symptom_id} reported: ${why}. Prompt consultation suggested.`);
  s.dialog.flagged = "doctor";
}

// Clinic-visit scenario: the pre-visit report (/report) is marked sent and the doctor is told it is ready.
export function sendReport(s: State) {
  s.reportSentAt = s.now;
  alert(s, "report", ["doctor"], "Pre-visit report is ready: medicines, DRP flags, adherence and symptoms.");
}

// After-visit scenario, step 2: drug names read off the prescription photo, waiting for the patient's "yes".
export function prescriptionRead(s: State, drugs: RxDrug[]) {
  if (!drugs.length) return say(s, "rx_unreadable");
  s.dialog = { ...s.dialog, current: "RX_CONFIRM", queue: [], pending_rx: drugs };
  say(s, "rx_found", undefined, drugs.map((d) => d.ingredient).join(", "));
}

// Step 3: confirmed drugs join the list, the rules rerun, and the doctor gets any new flag.
function addPrescription(s: State, drugs: RxDrug[]) {
  const ids = drugs.map((d, i) => {
    const id = `rx${s.meds.length + i + 1}`;
    s.meds.push({ id, ingredient: d.ingredient, dose: d.dose ?? "see prescription", slots: [], clinic: "New prescription (photo)", instructions: "Read from the prescription photo", source: "prescription_photo" });
    return id;
  });
  const before = new Set(s.flags.map((f) => f.id));
  s.flags = reevaluate(s);
  const fresh = s.flags.filter((f) => !before.has(f.id) && f.medIds.some((id) => ids.includes(id)));
  const names = drugs.map((d) => d.ingredient).join(", ");
  // Kidney wording only when a kidney-related rule (AKI, renal) already involves this ingredient.
  const kidney = s.flags.some((f) => /AKI|kidney|renal/i.test(f.detail) && f.medIds.some((id) => drugs.some((d) => s.meds.find((m) => m.id === id)?.ingredient === d.ingredient)));
  if (fresh.length || kidney)
    alert(s, "new_rx", ["doctor"], `New prescription from photo: ${names}. ${fresh.length ? `New flags: ${fresh.map((f) => f.title).join("; ")}.` : ""} Patient asked to check with the doctor before taking it.`);
  if (!fresh.length && !kidney) {
    s.dialog = { current: null, queue: [], flagged: false };
    return say(s, "rx_ok", undefined, names);
  }
  // Hajin's script: step 6 (the risk) now; step 8 (check with the doctor) answers the patient's next reply.
  say(s, kidney ? "rx_risk" : "rx_review", undefined, names);
  s.dialog = { current: "RX_ADVICE", queue: [], flagged: false };
}

// Applies one extracted answer. Order: emergency first (M05), then the question asked, then anything volunteered.
export function answer(s: State, x: Extraction) {
  const d = s.dialog, q = d.current, dose = todayDose(s);
  const today = s.symptoms.filter((y) => y.at === s.now);
  const sym = today.at(-1);
  let replied = false; // a tailored reply (A03) already closes the turn

  if (x.emergency_terms.length) {
    s.symptoms.push({ at: s.now, symptom_id: x.symptom_ids[0] ?? "S09", rule_answers: [], triage: "T01", patient_reported: true });
    alert(s, "T01", ["caregiver", "doctor"], `Emergency signs reported: ${x.emergency_terms.join(", ")}. Patient told to call 119.`);
    s.dialog = { current: null, queue: [], flagged: false };
    s.lastReminderAt = undefined;
    return say(s, "T01");
  }

  // "Should I stop it?" is never answered by Dafe: defer to the doctor and tell the doctor, then carry on.
  if (x.asks_advice && q !== "RX_ADVICE") {
    alert(s, "question", ["doctor"], "Patient asked whether to stop or change a medicine; told to check with the doctor first.");
    say(s, "ask_doctor");
    if (q && !q.startsWith("RX_")) say(s, q, d.slot);
    return;
  }

  // The two team-Doc scenarios can start at any point in the conversation.
  if (x.visit_soon) {
    sendReport(s);
    say(s, "report_sent");
    if (!q) return;
  }
  if (x.new_prescription && q !== "RX_CONFIRM") {
    s.dialog = { ...d, current: "RX_PHOTO", queue: [] };
    return say(s, "rx_photo_ask");
  }

  switch (q) {
    case "RX_PHOTO": // still waiting for the photo
      return say(s, "rx_photo_ask");
    case "RX_CONFIRM":
      if (x.answer === "yes" || x.taken_status === "taken") return addPrescription(s, d.pending_rx ?? []);
      s.dialog = { ...d, current: "RX_PHOTO", pending_rx: undefined };
      return say(s, "rx_retry");
    case "RX_ADVICE": // step 7 → 8: whatever the patient says ("Should I stop taking it?"), defer to the doctor
      if (x.asks_advice) alert(s, "question", ["doctor"], "After the new prescription, patient asked whether to stop it; told to check with the doctor first.");
      s.dialog = { current: null, queue: [], flagged: false };
      return say(s, "rx_advice");
    case "A01": // every scheduled check
      if (!x.taken_status && !x.symptom_ids.length) return say(s, "not_understood");
      if (dose && x.taken_status) Object.assign(dose, { taken_status: x.taken_status, reported_at: s.now });
      s.lastReminderAt = undefined;
      if (x.taken_status === "not_taken") d.queue.push("A03", ...(s.fullCheckin ? ["A04"] : []));
      else {
        if (x.taken_status === "taken") say(s, "taken_ack", d.slot);
        if (s.fullCheckin && x.taken_status === "taken") d.queue.push("A02"); // A02: if taken
        if (!x.symptom_ids.length) d.queue.push("A04"); // A04: daily
      }
      break;
    case "A02":
      if (dose && x.actual_dose_time) dose.actual_dose_time = x.actual_dose_time;
      break;
    case "A03": { // if not taken; M02 tailored guidance, never a dose change
      const reason = x.missed_reason ?? "other";
      if (dose) dose.missed_reason = reason;
      if (reason === "ran_out" || reason === "confusion" || reason === "cost") {
        alert(s, "refill", ["caregiver"], reason === "ran_out" ? "Patient says they ran out of medicine." : reason === "cost" ? "Patient says the medicine costs too much." : "Patient is confused about which medicine to take.");
        say(s, "close_caregiver");
      } else {
        if (reason === "discomfort") alert(s, "missed_dose", ["doctor"], `Missed ${d.slot} dose: patient says the medicine felt uncomfortable.`);
        say(s, reason === "forgot" || reason === "discomfort" ? `missed_${reason}` : "missed_other");
      }
      replied = true;
      break;
    }
    case "A05": // A05–A10: if symptomatic
      if (sym) sym.onset_relation = x.onset_relation ?? (x.answer === "yes" ? "before_dose" : x.answer === "no" ? "after_dose" : "unknown");
      break;
    case "A06":
      if (sym && x.rating !== null) sym.severity_demo = Math.max(1, x.rating);
      break;
    case "A07":
      if (sym && x.rating !== null) sym.activity_interference_demo = Math.min(3, x.rating);
      break;
    case "A08":
      if (sym) {
        sym.symptom_trend = x.symptom_trend ?? "unknown";
        // Tab 06: worsening dizziness (or swelling) is a T02 example.
        if (sym.symptom_trend === "worsened" && sym.symptom_id === "S07") escalate(s, sym, "dizziness worse than yesterday");
      }
      break;
    case "A09":
      if (sym) sym.perceived_drug_relation = x.answer ?? "unknown";
      break;
    case "A10":
      if (sym) sym.consulted_clinician = x.answer === "yes";
      break;
    default:
      if (q?.startsWith("FLAG:")) {
        const flag = s.flags.find((f) => f.id === q.slice(5));
        const ans = x.answer ?? (x.urgent_terms.length || x.symptom_ids.length ? "yes" : "unknown");
        sym?.rule_answers.push({ rule_id: flag?.ruleId ?? q, answer: ans });
        if (sym && flag && ans === "yes") escalate(s, sym, `positive answer to the ${flag.ruleId} question (${flag.title})`);
      }
  }

  // Answers to follow-ups often repeat the symptom; count each symptom once per slot.
  for (const id of x.symptom_ids.filter((id) => !today.some((y) => y.symptom_id === id))) {
    const fresh: Symptom = { at: s.now, symptom_id: id, rule_answers: [], triage: "T03", patient_reported: true };
    s.symptoms.push(fresh);
    if (x.urgent_terms.length) escalate(s, fresh, x.urgent_terms.join(", "));
    // shortcut: the first symptom of the check-in drives the follow-ups; a second one is recorded without its own A05–A10.
    if (!today.length && !d.queue.includes("A05")) {
      d.queue.push("A05", ...(s.fullCheckin ? ["A06", "A07", "A08", "A09", "A10"] : []));
      const rq = ruleQuestion(s);
      if (rq) d.queue.push(`FLAG:${rq.id}`);
    }
  }

  if (x.otc_painkiller && !s.meds.some((m) => !m.stoppedAt && m.source === "patient_reported")) {
    s.meds.push({ id: `otc${s.meds.length + 1}`, ingredient: "ibuprofen", dose: "unknown (OTC)", slots: [], clinic: "Bought without prescription", instructions: "Reported by patient", source: "patient_reported" });
    s.flags = reevaluate(s);
    d.flagged = "doctor";
  }
  if (x.sbp || x.weightKg || x.glucose)
    s.vitals.push({ at: s.now, sbp: x.sbp ?? undefined, dbp: x.dbp ?? undefined, weightKg: x.weightKg ?? undefined, glucose: x.glucose ?? undefined, source: "patient" });

  d.current = d.queue.shift() ?? null;
  if (d.current) return say(s, d.current, d.slot);
  // Closing line by tab 06: T02 → consult promptly, T03 → rest and call if it continues.
  const symptomToday = s.symptoms.some((y) => y.at === s.now);
  if (d.flagged === "doctor") say(s, "close_flag");
  else if (symptomToday) say(s, "close_t03");
  else if (!replied) say(s, "close_ok");
  s.dialog = { current: null, queue: [], flagged: false };
}
