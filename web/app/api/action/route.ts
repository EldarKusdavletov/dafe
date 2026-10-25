import { z } from "zod";
import { fireSlot, sendReport } from "@/lib/dialog";
import { alert, getState, reevaluate, reset, say, SILENCE_MS } from "@/lib/store";

const Slots = z.array(z.enum(["morning", "evening"]));
const Action = z.discriminatedUnion("type", [
  z.object({ type: z.literal("reset") }),
  z.object({ type: z.literal("fire"), slot: z.enum(["morning", "evening"]) }),
  z.object({ type: z.literal("skip") }),
  z.object({ type: z.literal("settings"), lang: z.enum(["en", "ko"]).optional(), useLLM: z.boolean().optional(), fullCheckin: z.boolean().optional() }),
  z.object({ type: z.literal("flag"), id: z.string(), status: z.enum(["new", "reviewed"]), note: z.string().max(500).optional() }),
  z.object({ type: z.literal("ack"), id: z.string() }),
  z.object({ type: z.literal("report"), taken: z.boolean(), issues: z.array(z.string().max(60)).max(10), note: z.string().max(500),
    sbp: z.number().optional(), dbp: z.number().optional(), weightKg: z.number().optional() }),
  z.object({ type: z.literal("medStop"), id: z.string() }),
  z.object({ type: z.literal("medDose"), id: z.string(), dose: z.string().min(1).max(30) }),
  z.object({ type: z.literal("medAdd"), ingredient: z.string().trim().toLowerCase().min(1).max(60),
    dose: z.string().min(1).max(30), slots: Slots, clinic: z.string().min(1).max(60), instructions: z.string().max(120) }),
  z.object({ type: z.literal("confirmMeds") }),
  z.object({ type: z.literal("sendReport") }),
]);

export async function POST(req: Request) {
  const parsed = Action.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.message }, { status: 400 });
  const a = parsed.data;
  if (a.type === "reset") { reset(); return Response.json({ ok: true }); }
  const s = getState();
  switch (a.type) {
    case "fire": fireSlot(s, a.slot); break;
    case "skip": if (s.lastReminderAt) s.lastReminderAt -= SILENCE_MS; break;
    case "settings": { const { type: _t, ...settings } = a; Object.assign(s, settings); break; }
    case "flag": {
      const f = s.flags.find((x) => x.id === a.id);
      if (!f) return Response.json({ error: "no such flag" }, { status: 404 });
      f.status = a.status;
      if (a.note !== undefined) f.note = a.note;
      break;
    }
    case "ack": { const al = s.alerts.find((x) => x.id === a.id); if (al) al.ack = true; break; }
    case "report":
      s.reports.unshift({ at: s.now, taken: a.taken, issues: a.issues, note: a.note });
      if (a.sbp || a.weightKg) s.vitals.push({ at: s.now, sbp: a.sbp, dbp: a.dbp, weightKg: a.weightKg, source: "caregiver" });
      if (!a.taken) alert(s, "missed_dose", ["caregiver"], "Care worker reports medicines not taken during the visit.");
      break;
    case "medStop": case "medDose": {
      const m = s.meds.find((x) => x.id === a.id);
      if (!m) return Response.json({ error: "no such med" }, { status: 404 });
      if (a.type === "medStop") m.stoppedAt = s.now; else m.dose = a.dose;
      m.source = "doctor_visit";
      s.medChanges.push({ at: s.now, medId: m.id, change: a.type === "medStop" ? "stop" : "dose", detail: a.type === "medStop" ? `Stopped ${m.ingredient}` : `${m.ingredient} → ${a.dose}` });
      s.flags = reevaluate(s);
      break;
    }
    case "medAdd": {
      const { type: _type, ...med } = a;
      const id = `d${s.meds.length + 1}`;
      s.meds.push({ ...med, id, source: "doctor_visit" });
      s.medChanges.push({ at: s.now, medId: id, change: "add", detail: `Added ${a.ingredient} ${a.dose}` });
      s.flags = reevaluate(s);
      // Situation 3: a new drug conflicts with the existing list → doctor sees the flag, patient hears a neutral notice only.
      if (s.flags.some((f) => f.status === "new" && f.medIds.includes(id))) say(s, "new_med_review");
      break;
    }
    case "confirmMeds": s.medsConfirmedAt = s.now; break;
    case "sendReport": sendReport(s); break;
  }
  return Response.json({ ok: true });
}
