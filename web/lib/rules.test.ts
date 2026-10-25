import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import seed from "../data/seed.json" with { type: "json" };
import local from "../data/rules.json" with { type: "json" };
import { parseCsv } from "./csv.ts";
import { classOf, evaluate, parseRules, type EgfrRule, type Med } from "./rules.ts";
import { keywordExtract } from "./keywords.ts";

const table = parseRules(parseCsv(readFileSync(new URL("../data/team/en/05_Drug_Class_Assessment.csv", import.meta.url), "utf8")));
const meds = seed.meds.map((m) => ({ ...m, source: "imported" })) as Med[];
const egfrRules = local.egfrRules as EgfrRule[];
const ids = (ms: Med[], egfr = 38) => evaluate(ms, egfr, table, egfrRules).map((f) => f.ruleId).sort();

test("csv reader handles quotes, escaped quotes and newlines in fields", () => {
  assert.deepEqual(parseCsv('a,b\n"x, y","say ""hi""\nthere"\n'), [{ a: "x, y", b: 'say "hi"\nthere' }]);
});

test("triple rows that list only brands resolve to ingredients", () => {
  assert.deepEqual(table.find((r) => r.id === "T002")!.groups.slice(1).map((g) => [...new Set(g)]), [["furosemide"], ["ibuprofen"]]);
  assert.equal(classOf(table).get("losartan"), "Angiotensin II receptor blocker (ARB)");
});

test("patient A raises the two planted risks plus the eGFR placeholder", () => {
  assert.deepEqual(ids(meds), ["T002", "duplicate", "metformin-egfr45"]);
});

test("the triple hides the pairs inside it; stopping ibuprofen clears it", () => {
  assert.ok(!ids(meds).some((id) => id.startsWith("DDI")));
  assert.deepEqual(ids(meds.map((m) => (m.ingredient === "ibuprofen" ? { ...m, stoppedAt: "now" } : m))), ["duplicate", "metformin-egfr45"]);
});

test("a new drug added at the visit is checked against the existing list", () => {
  const added = [...meds, { id: "d1", ingredient: "spironolactone", dose: "25 mg", slots: ["morning"], clinic: "Nephrology", instructions: "", source: "doctor_visit" }] as Med[];
  assert.ok(ids(added).includes("DDI005")); // ARB + MRA, hyperkalemia
});

test("review status survives re-evaluation", () => {
  const first = evaluate(meds, 38, table, egfrRules);
  first[0].status = "reviewed";
  assert.equal(evaluate(meds, 38, table, egfrRules, first)[0].status, "reviewed");
});

test("keyword fallback reads the script lines", () => {
  assert.equal(keywordExtract("Yes, I just took it with some water").taken_status, "taken");
  assert.deepEqual(keywordExtract("I feel a little dizzy when I stand up").symptom_ids, ["S07"]);
  assert.equal(keywordExtract("Yes, I felt dizzy before taking it").onset_relation, "before_dose");
  assert.equal(keywordExtract("Yes, I felt dizzy before taking it").taken_status, null);
  assert.equal(keywordExtract("먹었어요, 근데 어지러워요").taken_status, "taken");
  assert.equal(keywordExtract("I didn't take it, I ran out").missed_reason, "ran_out");
  assert.deepEqual(keywordExtract("I bought a painkiller").symptom_ids, []);
  assert.deepEqual(keywordExtract("I have chest pain").emergency_terms, ["chest_pain"]);
  assert.equal(keywordExtract("2").rating, 2);
  assert.equal(keywordExtract("It was severe").rating, 3);
  assert.equal(keywordExtract("It's worse than yesterday").symptom_trend, "worsened");
  assert.equal(keywordExtract("120 over 80").rating, null);
  assert.equal(keywordExtract("Around eight o'clock").actual_dose_time, "eight o'clock");
  assert.equal(keywordExtract("아침 8시쯤").actual_dose_time, "8시");
  assert.equal(keywordExtract("The doctor gave me something for my knee pain").new_prescription, true);
  assert.equal(keywordExtract("I'm seeing my doctor tomorrow").visit_soon, true);
  assert.equal(keywordExtract("I feel a little dizzy").new_prescription, false);
  assert.equal(keywordExtract("Oh, I didn't know that. Should I stop taking it?").asks_advice, true);
  assert.equal(keywordExtract("그럼 이 약 그만 먹어야 해?").asks_advice, true);
  assert.equal(keywordExtract("Yes, I just took it with some water").asks_advice, false);
});
