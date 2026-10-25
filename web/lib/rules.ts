// Pure rule engine: every flag comes from the team's rule table (sheet tab 05) or the local
// placeholder rules, never from the LLM.
export type Med = {
  id: string; ingredient: string; dose: string; slots: ("morning" | "evening")[];
  clinic: string; instructions: string;
  source: "imported" | "doctor_visit" | "patient_reported" | "prescription_photo"; stoppedAt?: string;
};
export type InteractionRule = {
  id: string; name: string; classes: string[]; groups: string[][];
  question: string; risk: string; caution: string; type: string; url: string;
};
export type EgfrRule = { id: string; ingredient: string; egfrBelow: number; message: string; source: string };
export type Flag = {
  id: string; ruleId: string; kind: "interaction" | "duplicate" | "egfr_dose"; medIds: string[];
  title: string; detail: string; question?: string; source: string;
  status: "new" | "reviewed"; note?: string;
};

export const norm = (s: string) => s.toLowerCase().replace(/\s+(tablets?|capsules?|injection)\b.*$/, "").trim();

// "Ibuprofen (Brufen; Advil)" → ibuprofen + brands. Triple rows list only brands ("Lasix"),
// so brands seen anywhere in the table are mapped back to their ingredient.
const items = (group: string) =>
  [...group.matchAll(/([^;()]+?)\s*(?:\(([^)]*)\))?\s*(?:;|$)/g)]
    .map((m) => ({ name: norm(m[1]), brands: (m[2] ?? "").split(";").map(norm).filter(Boolean) }))
    .filter((x) => x.name);

export function parseRules(rows: Record<string, string>[]): InteractionRule[] {
  const parsed = rows.filter((r) => r["Rule ID"]).map((r) => ({ r, groups: r["Example Ingredients / Brands"].split(" | ").map(items) }));
  const alias = new Map(parsed.flatMap(({ groups }) => groups.flat().flatMap((it) => it.brands.map((b) => [b, it.name] as const))));
  return parsed.map(({ r, groups }) => ({
    id: r["Rule ID"], name: r["Drug Class / Combination"], classes: r["Drug Class / Combination"].split(" + "),
    groups: groups.map((g) => g.map((it) => alias.get(it.name) ?? it.name)),
    question: r["Additional Patient Question (Development Draft)"], risk: r["Risk Context"],
    caution: r["Caution"], type: r["Interaction Type"], url: r["Source URL"],
  }));
}

// ingredient → drug class name, read off the rule table.
export const classOf = (rules: InteractionRule[]) =>
  new Map(rules.flatMap((r) => r.groups.flatMap((g, i) => g.map((ing) => [ing, r.classes[i]] as const))));

export function evaluate(meds: Med[], egfr: number, rules: InteractionRule[], egfrRules: EgfrRule[], prev: Flag[] = []): Flag[] {
  const active = meds.filter((m) => !m.stoppedAt);
  const hits: Omit<Flag, "id" | "status" | "note">[] = [];

  for (const rule of rules) {
    const used: string[] = [];
    for (const group of rule.groups) {
      const m = active.find((x) => !used.includes(x.id) && group.includes(norm(x.ingredient)));
      if (!m) break;
      used.push(m.id);
    }
    if (used.length === rule.groups.length)
      hits.push({ ruleId: rule.id, kind: "interaction", medIds: used, title: rule.name, detail: `${rule.risk}. ${rule.caution}`, question: rule.question || undefined, source: rule.url });
  }
  // A triple already covers the pairs inside it; show the triple only.
  const triples = hits.filter((h) => h.medIds.length > 2);
  const shown = hits.filter((h) => h.medIds.length > 2 || !triples.some((t) => h.medIds.every((id) => t.medIds.includes(id))));

  for (const group of Map.groupBy(active, (m) => norm(m.ingredient)).values())
    if (new Set(group.map((m) => m.clinic)).size > 1)
      shown.push({ ruleId: "duplicate", kind: "duplicate", medIds: group.map((m) => m.id), title: `Same ingredient from ${group.length} departments: ${group[0].ingredient}`,
        detail: "The same ingredient was prescribed by different departments. Please confirm whether this dose is intended.", source: "Virtual patient A planted risk (Dohyeon)" });

  for (const rule of egfrRules)
    for (const m of active)
      if (norm(m.ingredient) === rule.ingredient && egfr < rule.egfrBelow)
        shown.push({ ruleId: rule.id, kind: "egfr_dose", medIds: [m.id], title: rule.message, detail: `Latest eGFR ${egfr}.`, source: rule.source });

  return shown.map((h) => {
    const id = `${h.ruleId}:${[...h.medIds].sort().join("+")}`;
    const old = prev.find((f) => f.id === id);
    return { ...h, id, status: old?.status ?? "new", note: old?.note };
  });
}
