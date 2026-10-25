import type { Extraction } from "./extract";

// Offline fallback when Claude is off or slow: English + Korean keywords.
// shortcut: regexes miss paraphrases, upgrade only if the LLM path proves unreliable on stage.
const has = (re: RegExp, t: string) => re.test(t);

export function keywordExtract(raw: string): Extraction {
  const t = raw.toLowerCase();
  const symptoms: [string, RegExp][] = [
    ["S01", /tired|fatigue|no energy|피곤|기운/], ["S02", /\bpain\b(?!kill)|hurts?\b|아파|통증/],
    ["S03", /concentrat|memory|깜빡/], ["S04", /can'?t sleep|sleep badly|잠/],
    ["S05", /itch|가려/], ["S06", /nause|vomit|appetite|stomach|메스|구토|속이/],
    ["S07", /dizz|faint|light-?headed|어지러|어지럽/], ["S08", /restless|legs/],
    ["S09", /short of breath|breathless|숨이 차|숨차/],
  ];
  const emergency: [string, RegExp][] = [
    ["chest_pain", /chest pain|가슴.*(아파|통증)/], ["severe_dyspnea", /can'?t breathe|숨을 못/],
    ["syncope", /fainted|passed out|쓰러졌/], ["confusion", /very confused|의식/],
    ["face_swelling", /(face|lips?|tongue) (is |are )?swell|swollen (face|lips?|tongue)|(얼굴|입술|혀).*부/],
  ];
  const urgent: [string, RegExp][] = [
    ["reduced_urine", /(less|little|no) (urine|pee)|소변.*(줄|안 나)/],
    ["persistent_vomiting", /keep vomiting|계속 토/], ["persistent_diarrhea", /keep having diarrhea|계속 설사/],
    ["worsening_dizziness", /dizz\w* .*(worse|more)|더 어지러/], ["worsening_edema", /swelling .*(worse|more)|부기.*심해/],
  ];
  const notTaken = has(/didn'?t|did not|haven'?t|not yet|forgot|안 ?먹|못 ?먹/, t);
  const unsure = has(/not sure|don'?t remember|can'?t remember|기억/, t);
  const taken = has(/\btook\b|\btaken\b|i did\b|먹었/, t);
  const bp = t.match(/(\d{2,3})\s*(?:\/|over)\s*(\d{2,3})/);
  const weight = t.match(/(\d{2,3}(?:\.\d)?)\s*(?:kg|kilo)/);
  return {
    taken_status: notTaken ? "not_taken" : unsure ? "unsure" : taken ? "taken" : null,
    actual_dose_time: t.match(/\b\d{1,2}:\d{2}\b|\b\d{1,2}\s*(?:am|pm)\b|\b(?:\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s*o'?clock|\d{1,2}\s*시(?:\s*\d{1,2}\s*분)?/)?.[0] ?? null,
    rating: (() => {
      const n = t.match(/^\D*\b([0-4])\b\D*$/) ?? t.match(/^\s*(zero|one|two|three|four)\b/);
      const word = ["zero", "one", "two", "three", "four"];
      return n ? (word.includes(n[1]) ? word.indexOf(n[1]) : Number(n[1]))
        : has(/not at all|전혀/, t) ? 0 : has(/very severe|unbearable|너무 심/, t) ? 4 : has(/severe|심해|심했/, t) ? 3 : has(/moderate|보통/, t) ? 2 : has(/mild|a little|조금|약간/, t) ? 1 : null;
    })(),
    symptom_trend: has(/worse|더 심|나빠/, t) ? "worsened" : has(/better|improv|좋아졌|나아/, t) ? "improved" : has(/same|unchanged|그대로|똑같/, t) ? "unchanged" : null,
    onset_relation: has(/\bbefore\b|먹기 전|전부터/, t) ? "before_dose" : has(/\bafter\b|먹고 나서|후에/, t) ? "after_dose" : null,
    missed_reason: has(/ran out|no (medicine|pills) left|떨어/, t) ? "ran_out"
      : has(/forgot|잊/, t) ? "forgot" : has(/uncomfortable|side effect|불편/, t) ? "discomfort"
      : has(/confus|헷갈/, t) ? "confusion" : has(/expensive|cost|비싸/, t) ? "cost" : null,
    symptom_ids: symptoms.filter(([, re]) => re.test(t)).map(([id]) => id) as Extraction["symptom_ids"],
    answer: has(/^\s*(yes|yeah|yep|i do)\b|^\s*(네|예|응)/, t) ? "yes" : has(/^\s*(no|nope)\b|^\s*아니/, t) ? "no" : null,
    emergency_terms: emergency.filter(([, re]) => re.test(t)).map(([id]) => id) as Extraction["emergency_terms"],
    urgent_terms: urgent.filter(([, re]) => re.test(t)).map(([id]) => id) as Extraction["urgent_terms"],
    sbp: bp ? Number(bp[1]) : null, dbp: bp ? Number(bp[2]) : null,
    weightKg: weight ? Number(weight[1]) : null, glucose: null,
    new_prescription: has(/gave me (something|a new|new)|new (medicine|prescription|pills?)|prescribed me|새 약|약을 새로|처방/, t),
    asks_advice: has(/should i (stop|skip|keep|still|change|double|not)|can i (stop|skip)|do i (stop|have to)|(그만|끊어|중단|안 먹어).*(돼|될까|해야|야 해|야 하|까요)|먹어도 (돼|될까)/, t),
    visit_soon: has(/(see|seeing|visit|visiting) (my|the) doctor|go(ing)? to the (hospital|clinic)|병원에 가|진료/, t),
    otc_painkiller: has(/painkiller|ibuprofen|pain (pill|medicine|reliever)|진통제/, t),
  };
}
