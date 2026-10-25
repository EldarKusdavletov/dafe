import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { query, type SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { keywordExtract } from "./keywords";

// The only thing the LLM produces: what the patient said, as data. Rules decide everything else.
export const ExtractionSchema = z.object({
  taken_status: z.enum(["taken", "not_taken", "unsure"]).nullable(),
  actual_dose_time: z.string().nullable(),
  missed_reason: z.enum(["forgot", "discomfort", "confusion", "ran_out", "cost", "other"]).nullable(),
  onset_relation: z.enum(["before_dose", "after_dose", "unknown"]).nullable(),
  rating: z.number().int().min(0).max(4).nullable(),  // A06 severity 1–4 / A07 activity interference 0–3
  symptom_trend: z.enum(["improved", "unchanged", "worsened", "unknown"]).nullable(),  // A08
  symptom_ids: z.array(z.enum(["S01", "S02", "S03", "S04", "S05", "S06", "S07", "S08", "S09"])),
  answer: z.enum(["yes", "no", "unknown"]).nullable(),
  emergency_terms: z.array(z.enum(["severe_dyspnea", "chest_pain", "syncope", "confusion", "face_swelling"])),
  urgent_terms: z.array(z.enum(["reduced_urine", "persistent_vomiting", "persistent_diarrhea", "worsening_dizziness", "worsening_edema"])),
  sbp: z.number().nullable(), dbp: z.number().nullable(),
  weightKg: z.number().nullable(), glucose: z.number().nullable(),
  otc_painkiller: z.boolean(),
  new_prescription: z.boolean(),  // after-visit scenario: "the doctor gave me something new"
  visit_soon: z.boolean(),        // clinic-visit scenario: "I'm seeing my doctor tomorrow"
  asks_advice: z.boolean(),       // "should I stop / skip / change it?" — never answered by Dafe, deferred to the doctor
});
export type Extraction = z.infer<typeof ExtractionSchema>;

const SYSTEM = `You turn one reply from an older adult to a medication-reminder speaker into structured data.
Extract only what the person actually said; use null or [] for anything not mentioned. Never give advice.
Symptom ids: S01 fatigue, S02 unusual pain, S03 memory/concentration, S04 sleep, S05 itchy skin,
S06 nausea/appetite/stomach, S07 dizziness or feeling faint, S08 restless legs, S09 shortness of breath.
"answer" is the yes/no answer to the question asked. onset_relation = whether a symptom began before or after the medicine.
rating = for a 1–4 or 0–3 scale question, always a number, mapped from words if needed:
severity 1 mild, 2 moderate, 3 severe, 4 very severe; activity interference 0 none, 1 a little, 2 somewhat, 3 could not do usual activities.
symptom_trend = compared with yesterday. otc_painkiller = they bought or took a painkiller not from the doctor.
new_prescription = they say a doctor just gave them a new medicine or prescription. visit_soon = they say they will see their doctor or go to the hospital soon.
asks_advice = they ask whether they should stop, skip, change, double or keep taking a medicine.`;

// Empty working dir so no project CLAUDE.md or settings leak into the subprocess.
const cwd = join(tmpdir(), "pharmpharm-extract");
mkdirSync(cwd, { recursive: true });
// Never bill an API key: the Claude Code subprocess uses the Claude Pro login.
const env = { ...process.env, ANTHROPIC_API_KEY: undefined };

// One Claude call that must return JSON matching `schema`; null on failure or timeout (callers fall back).
async function structured<T>(prompt: string | AsyncIterable<SDKUserMessage>, systemPrompt: string, schema: z.ZodType<T>, timeoutMs: number): Promise<T | null> {
  const abortController = new AbortController();
  const timer = setTimeout(() => abortController.abort(), timeoutMs);
  try {
    for await (const msg of query({
      prompt,
      options: {
        model: "claude-haiku-5-5", systemPrompt, tools: [], settingSources: [],
        maxTurns: 3, effort: "low", persistSession: false, cwd, env, abortController,
        outputFormat: { type: "json_schema", schema: z.toJSONSchema(schema, { target: "draft-7" }) as Record<string, unknown> },
      },
    })) {
      if (msg.type === "result" && msg.subtype === "success" && msg.structured_output) return schema.parse(msg.structured_output);
    }
  } catch (err) {
    console.error("Claude call failed, using fallback:", err);
  } finally {
    clearTimeout(timer);
  }
  return null;
}

export async function extract(text: string, question: string, useLLM: boolean): Promise<{ data: Extraction; by: "claude" | "keywords" }> {
  const data = useLLM ? await structured(`Question asked: ${question}\nPatient said: ${text}`, SYSTEM, ExtractionSchema, 15_000) : null;
  return data ? { data, by: "claude" } : { data: keywordExtract(text), by: "keywords" };
}

// After-visit scenario: read drug names off a prescription photo. Claude only transcribes; the rules judge the drugs.
const RxSchema = z.object({ drugs: z.array(z.object({ ingredient: z.string(), dose: z.string().nullable() })) });
export type RxDrug = z.infer<typeof RxSchema>["drugs"][number];
const RX_SYSTEM = `You read a photo of a medicine prescription or pharmacy bag. List every medicine on it.
ingredient = the generic ingredient name in lowercase English (e.g. a brand like Brufen becomes "ibuprofen"). dose = strength as written, or null.
If the image is not a prescription or nothing is readable, return an empty list. Never add medicines that are not on the image.`;

export async function readPrescription(image: { mediaType: "image/jpeg" | "image/png"; base64: string }, useLLM: boolean, fallbackText: string, known: string[]) {
  if (useLLM) {
    async function* photo(): AsyncIterable<SDKUserMessage> {
      yield { type: "user", parent_tool_use_id: null, message: { role: "user", content: [
        { type: "image", source: { type: "base64", media_type: image.mediaType, data: image.base64 } },
        { type: "text", text: "List the medicines on this prescription." },
      ] } };
    }
    const out = await structured(photo(), RX_SYSTEM, RxSchema, 40_000);
    if (out) return { drugs: out.drugs.map((d) => ({ ...d, ingredient: d.ingredient.toLowerCase().trim() })), by: "claude" as const };
  }
  // shortcut: offline fallback only works for the built-in sample photo, whose text the page sends along.
  const t = fallbackText.toLowerCase();
  return { drugs: known.filter((k) => t.includes(k)).map((ingredient) => ({ ingredient, dose: null })), by: "keywords" as const };
}
