# PharmPharm — Team 5, UU Digital Healthcare Hackathon 2026

Prototype for a 2-day hackathon (UNIST + Ulsan Univ. College of Medicine + Yonsei College of Nursing), Oct 24–25, 2026. Theme: **Caregiving (돌봄)**. Eldar builds the prototype; this folder is for it.

## What we're building

An AI agent that prevents **adverse drug events (ADE) in older adults (65+) with chronic kidney disease** — CKD stage 3–4, with diabetes and/or hypertension, on 5+ drugs, not on dialysis.

Why: Korea's DUR checks duplicates at prescribing/dispensing but **does not account for kidney function**. We do the kidney-aware check at home, including OTC painkillers DUR never sees.

Three users on one shared system (pharmacist role dropped after mentoring #1, Sat: pharmacists have no prescribing/medical authority in Korea, so flags go to the doctor):
- **Older adult** — AI voice speaker: medication reminders, "did you take it?", daily questions (BP, weight, swelling, blood sugar, any painkillers bought).
- **Caregiver** (family / care worker) — gets missed-dose alerts, files short medication-focused reports.
- **Doctor** — reviews medication-safety flags (eGFR–dose mismatch, drug–drug combos from the team's rule table, same-ingredient duplicates across departments), pre-visit briefing (eGFR/BP/weight trends, symptoms, adherence), edits the med list during the visit.

**Naming (team, Sat night):** product = **Dafe** (voice AI agent); say **DRPs (drug-related problems)**, not "ADE" (Hajin: ADE is too specific; Dohyeon agreed). Demo patient (Eldar, Sun 10:00) = **Mrs. Kim, 78 F** (Hajin's persona: lives alone in Ulsan, daughter in Seoul) with patient A's drugs, labs and planted risks; the app greets "Good morning, Mrs. Kim!". Toty's pitch script still says Mr. Lee, 76: align the script or the app before recording. Deck title: "AI agent for preventing Drug Related Problems (DRPs) in polypharmacy patients with CKD". Roles on slide 1: Hajin CEO · Toty CCO · **Eldar CTO** · Dohyeon CSO · Mingyeom CPO.

## Hard constraints (legal + pitch)

- No prescribing in our system. Doctors **confirm** the medication list/schedule; prescriptions come from the hospital (prescription photo/OCR or patient-consented record import).
- No diagnosis, no dose calculation, no "stop/skip this pill". The system **flags for doctor review**; the speaker says "I've noted it and I'll let your doctor know." When a newly added drug conflicts, the patient hears only a neutral notice ("your doctor is reviewing your new medicine together with your other medicines"), no drug names or stop/skip instructions.
- Interaction/eGFR alerts go to the doctor, not to the patient as instructions.
- Decisions come from explicit rules, not from the LLM. The LLM only turns free speech into structured data.
- Speaker identifies itself as AI. Fake data only — no real names, hospitals, drug brands or logos.

## Judging (official slide, Sat 18:25)

Team intro & engagement 10 · **Problem 20** · **Solution 20** · Market & competitors 15 · Business plan 15 · **Results of initial model 15** ("if software/AI is proposed, does this preliminary development show a promising prospect toward a feasible final product?") · **finishing within 8 min = +20 extra**. Organizer tip: **show app demos as a demonstration movie embedded in the slides** (not live). So the prototype's deliverable is a polished screen recording; live demo only as backup.

Team split (Hajin, Slack 18:29): Eldar — connect DB + website + voice AI on the example script; slides — Problem: Toty · Solution: Hajin · Market size: Dohyeon · Business plan: Mingyeom. Team goal: everything done before the **Sun 09:30** feedback session.

## Demo the prototype must show (slide 6, ~90 s, recorded video)

1. Virtual CKD patient with ~10 drugs from 3 clinics → system shows the planted problems → doctor's medication safety review.
2. Morning: speaker reminds in Korean; patient answers "먹었어요, 근데 어지러워요" → intake + symptom logged.
3. Evening: two reminders unanswered → caregiver alert.
4. Doctor opens the pre-visit briefing.

Record it as the demo movie for the slide (organizers' recommendation); keep the live app only as backup. Toty needs real screenshots of the caregiver and doctor screens for the concept video.

## Inputs from the clinical teammates (due Sat 21:00)

### Received

**Scope confirmed** (Sat ~16:15): the CKD scope paragraph above is now the "General/Shared" section of the team Google Doc; Eldar's "Is this right???" comment was resolved.

**Assessment list = the functional requirements** (Hajin, YUCN). Two copies with identical structure — use the English one for code, the Korean one for the speaker's Korean wording:
- English: Google Sheet `1v_qiewpx1Yu5fdVaZEFhIwcEWev0IwfiZZbC5Sqf_ZM` ([link](https://docs.google.com/spreadsheets/d/1v_qiewpx1Yu5fdVaZEFhIwcEWev0IwfiZZbC5Sqf_ZM/edit))
- Korean: Google Sheet `1qSBGALuhyOT5yHisF5Xe4HKz7yOIkudlZaq_86pcDYg` ([link](https://docs.google.com/spreadsheets/d/1qSBGALuhyOT5yHisF5Xe4HKz7yOIkudlZaq_86pcDYg/edit))

Read with the Google Drive tool. What the AI must do = tab 02 (features F01–F08, each with a "development caution") + tab 08 (MVP scope M01–M11 with P0/P1/P2, input, output, validation point). Tab 05 (drug-class rules) may still change after the UUCM members' research. Tabs as of Sat ~16:15 (no tab 06):

| Tab | Content | Use in prototype |
| --- | --- | --- |
| 01_근거문헌 | REF01–08: PubMed reviews, KSB-Q (CKD symptom questionnaire), PROMIS PMAS, PRO-CTCAE, KDIGO 2024. All marked "verify against original" | Slide citations only |
| 02_추가기능 | F01–F08 features with priority: intake confirmation → missed reason → post-dose symptom check → onset → drug-class questions → instructions → 7-day trend → pre-visit summary | Feature map |
| 03_공통사정 | A01–A10 Korean patient questions with answer type, options and **DB field names** (`taken_status`, `actual_dose_time`, `missed_reason`, `new_worsening_symptom`, `onset_relation`, `onset_time`, `severity_demo` 1–4, `activity_interference_demo` 0–3, `symptom_trend`, `perceived_drug_relation`, `consulted_clinician`) and when each is asked | Daily check-in flow + data fields — use these names |
| 04_CKD증상 | S01–S09 symptoms (fatigue, pain, memory, sleep, skin, GI, **dizziness S07**, restless legs, dyspnea) with Korean questions | Symptom list |
| 05 drug class (may change) | **EN sheet rebuilt Sat 17:11** as `05_Drug_Class_Assessment`: 42 combination rules = Dohyeon's 30 pairs (DDI001–DDI030) + 12 triples (T001–T012), each with a patient follow-up question, risk context, caution, source record + URL (the "Objective Data to Check" column was removed at 17:15; DDI002's question is blank — Hajin is still editing, re-export before relying on it). Exported to `data/team-inputs/assessment_05_drug_class_EN.csv` — **use this as the single rule table** (it supersedes Dohyeon's CSVs for code). The old single-class rows D01–D07 (incl. metformin, SGLT2i, sulfonylurea) are gone from EN; the Korean sheet still has them | "If patient has combo X, flag + ask Y" rules |
| 07_위험대응 | T01 emergency (severe dyspnea, chest pain, syncope, altered consciousness → stop check-in, direct to emergency care) · T02 prompt consult (much less urine, persistent vomiting/diarrhea, worsening dizziness/edema) · T03 observe | Alert triage branches |
| 08_MVP범위 | M01–M05 P0 (intake, missed reason, symptoms, onset/severity, danger guidance) · M06–M09 P1 (drug-class questions, 7-day trend, clinician summary, BP/weight input) · M10–M11 P2 (device integration, risk model) | Matches our demo; P2 is out of scope |
| 09_검증한계 | Patient report ≠ confirmed ADE; scales are dev-only; effect unproven | Q&A answers; label scales "demo" in UI |

Demo fit (built): Hajin's morning script A01 → A04 → S07 → A05 (before/after the dose) → the matched rule's patient question (T002 triple whammy for patient A) → "yes" → T02 alert to the doctor and caregiver.

**Drug–drug interaction rules** (Dohyeon Kang, UUCM — posted in #pharmpharm Sat 16:13–16:29), saved in `data/team-inputs/` (xlsx originals + CSV copies):
- `ckd_ddi_pairs_updated_english.csv` — 30 **pairwise** rules, latest English version: Drug A category · examples (generic/brand) · Drug B category · examples · interaction category · potential adverse effects · reference URL (EMA, kidney.org, NCBI, DailyMed, FDA). Categories: dual RAAS blockade, hyperkalemia risk (ACEi/ARB/MRA/K+ supplement/trimethoprim), renal hemodynamic (ACEi/ARB/diuretic + NSAID), additive nephrotoxicity, pharmacokinetic (tacrolimus, lithium, methotrexate + NSAID), bleeding (warfarin + NSAID), CNS (gabapentin + opioid).
- `ckd_triple_drug_interactions.csv` — 12 **three-drug** rules T001–T012 (Korean headers): triple whammy ACEi/ARB + furosemide/HCTZ + ibuprofen (T001–T004), additive potassium ACEi/ARB + MRA + KCl/trimethoprim (T005–T012). Has `mechanism`, `recommended review`, `matching_logic` = `ALL_3_PRESENT`, `clinical_validation_status` = `PROTOTYPE_REQUIRES_CLINICAL_REVIEW` — show that status in the UI.
- `ckd_triple_drug_v2.csv` (Sat 16:37) — **latest** English version of the same T001–T012, with class names (ACE inhibitor / ARB / Loop diuretic / Thiazide / NSAID / MRA / Potassium supplement / Folate antagonist antibiotic) and a reference URL per rule (bpac.org.nz triple whammy, DailyMed). Prefer it over the older triple file.
- Rules are at drug-**class** level with example ingredients, so the matcher must map each patient drug (ingredient) → class. Some rows (vancomycin + gentamicin, tacrolimus) are inpatient/transplant — not relevant for the home demo patient; the core demo rows are RAAS + NSAID, triple whammy, potassium.

**Virtual patient A** (Dohyeon, Sat 16:37) — `data/team-inputs/virtual_patient_A.md` (transcribed from the docx images; original docx alongside). 76 M, CKD G3b, eGFR 38, Cr 1.8, K+ 4.7, BP 138/82; CKD + T2DM + HTN + dyslipidemia + knee OA; 10 drugs from nephrology / endocrinology / orthopedics (losartan, amlodipine ×2, furosemide, dapagliflozin, metformin 500 bid, linagliptin, atorvastatin, ibuprofen 400 bid, acetaminophen prn). **Planted risks:** (1) amlodipine 5 mg duplicated by two departments (morning + evening); (2) triple whammy losartan + furosemide + ibuprofen. The file includes the exact alert wording for both. The docx also has pitch stats (KSN 2026 fact sheet, NHIS polypharmacy numbers) — useful for slides, not code.
- Persona: the app uses **Mrs. Kim, 78** (Eldar's call, Sun 10:00) with patient A's ten drugs; Toty's pitch script says Mr. Lee, 76.

**Speaker script — morning check-in** (Hajin, Doc, Yonsei section) — `data/team-inputs/speaker_script_morning.md`, Korean + English: reminder → "taken" → "how are you feeling?" → dizziness on standing → onset before/after the dose → "sit and rest, call the clinic if it continues" → re-check after 5 min. Maps to A01 → A04 → S07 → A05. The Doc also has two more script slots, still empty: **at the clinic visit** (tell the doctor the drug list + ADE-focused record) and **after the visit** ("notifying possible ADE to the patient").
- **Team's demo structure** (Slack, Sat 16:54–17:02): Hajin's 3 situations — (1) daily monitoring: intake + symptoms; (2) at the clinic visit: drug list + ADE-focused record to the doctor; (3) after the visit: possible ADE between new and existing drugs. Toty added (4): the system sends intake + condition reports to the family/caregiver. These 4 = the demo flow; align the prototype screens to them.
- Ulsan section of the Doc — "의료데이터 공유 현황" (medical data sharing, pitch material for the problem slide): 10,332 institutions join the government clinical-information exchange but only ~600 can share CT/MRI ([Yonhap](https://www.yna.co.kr/amp/view/AKR20260211156000530)); the patient-driven Health Information Highway (건강정보 고속도로) links only 1,264 institutions. Plus two images (not readable via API).
- Resolved (Eldar, Sat): "after the visit" = the speaker gives a neutral notice only ("your doctor is reviewing your new medicine together with your other medicines; they will contact you"), and the doctor gets the flag.
- Built (Eldar, Sun 10:30): Hajin's after-visit script **softened**: prescription photo → Claude reads the drug name → patient confirms → rules rerun → if a kidney-related rule involves the drug: "{drug} may affect kidney function, especially in people with CKD like you. Please check with your doctor before taking the new medicine." Doctor only (no pharmacist), no stop/skip order. The clinic-visit report is `/report`. Original note: **Hajin's after-visit script landed (Doc, Sun ~02:00)** and conflicted with the neutral notice: patient says the doctor gave something for knee pain → AI asks for a prescription **photo** → "I found ibuprofen, is that right?" → "**Ibuprofen may affect kidney function, especially in people with CKD like you**" → "Please check with your doctor or pharmacist before taking the new medicine. I'll help you share your medication list and kidney condition." It names the drug and the risk to the patient (and mentions pharmacist). Eldar to decide: keep our neutral notice, or adopt her wording (softer: no stop/skip order, but drug-specific risk to patient). The photo → OCR → confirm-the-name step is new and demo-worthy.
- **Clinic-visit scenario** (Doc): the doctor gets a report of the drug list + DRP-focused health record — "not chatting style, AI report style".
- **Pitch script by Toty** (Doc, UNIST section, Sun 02:02 — "talk very fast to fit the time"): 11 slides + closing, timed ≈8:10. **Slide 11 Results/demo = 1:20**: medication reminder → patient's voice answer → risk flagged → caregiver alert → doctor's report. "How Dafe works" = 4 steps: (1) new prescription → screen duplicates, combos, doses vs kidney function; (2) home → calls at med time, adherence + symptoms; (3) before visit → structured report to doctor; (4) warning signs → caregiver alert + guide to emergency care. Line to keep true in the product: "Dafe never diagnoses or changes doses. It checks, records and forwards. The doctor decides."
- **Shared deck** (Toty, Sat 20:13): Google Drive pptx `1QrelpHza4jhTupQzMI-l1YkpSs6OYr-1` ([link](https://docs.google.com/presentation/d/1QrelpHza4jhTupQzMI-l1YkpSs6OYr-1/edit)). Font Arial; references APA 7 (Hajin). As of Sun 09:30: Problem, solution (4 features), CKD + polypharmacy market, competitor table (SAVi Health, Medisafe, Onedose vs Dafe — "AI generates symptom questions from the patient's medication list", "patient-centered") are filled; **Business Development Plan and Results of Initial Models are empty** (results = Eldar's demo video). Toty made a logo (Slack file `F0CC04EDXUL`).

### Still missing (use placeholders until they arrive)

1. **eGFR dose thresholds** per drug (e.g., metformin cut-off; patient A has eGFR 38 on metformin 1000 mg/day) — the core "DUR doesn't check kidneys" feature; all rules so far are drug–drug only, nothing keyed on eGFR.
2. **Numeric alert thresholds** for BP, weight gain, urine output (patient A has one BP and one K+ value, no trends or cut-offs).
3. The other 2 personas (long-distance adult child, care worker 3×/week) and the clinic-visit / after-visit scripts — Hajin, due Sat 21:00.

## Deadlines (KST)

Sat 19:00 mentoring #1 · Sat 23:00 end-to-end scenario works · Sun 09:30 mentoring #2 (demo + recording) · **Sun 12:00 freeze** · **Sun 14:00 slides due** · 14:30 finals (8 min + 2 min Q&A, English).

## Working rules

- Smallest thing that makes the demo work; cut anything not in the demo. Architecture and stack are decided with Eldar, not assumed.
- Never post to Slack, edit team docs or message teammates without Eldar's explicit OK.

## References

- Briefs: [EN](https://claude.ai/artifact/KbStzAjHo8otjhMUK6Fbti) · [KR](https://claude.ai/artifact/59etAmLA1rTzBpJBLwsMPS) · [RU, Eldar + Toty](https://claude.ai/artifact/EeN5g4Qd45eaLvNbkqgcN9)
- Team Slack: #pharmpharm (C0CBNTK9JKF) · team Google Doc "pharmpharm" (10pBHOYPpkOx4H7koCq8klXpEdaWV_Gz6DHMtDe3K6DQ)
- Slide template: 6 slides — Title/roles · Problem · Solution · Market & competitors · Business plan · Results of initial model

## Team data sources — how to access

When asked to "scan" or analyze team inputs, refresh from the live sources first (teammates keep editing), then fall back to local copies.

| What | Link | ID |
| --- | --- | --- |
| Assessment list, **English** (functional requirements — use for code) | [sheet](https://docs.google.com/spreadsheets/d/1v_qiewpx1Yu5fdVaZEFhIwcEWev0IwfiZZbC5Sqf_ZM/edit) | `1v_qiewpx1Yu5fdVaZEFhIwcEWev0IwfiZZbC5Sqf_ZM` |
| Assessment list, Korean (speaker wording; still has D01–D07 single-class rows) | [sheet](https://docs.google.com/spreadsheets/d/1qSBGALuhyOT5yHisF5Xe4HKz7yOIkudlZaq_86pcDYg/edit) | `1qSBGALuhyOT5yHisF5Xe4HKz7yOIkudlZaq_86pcDYg` |
| Team Google Doc "pharmpharm" (scope, persona, scripts, Ulsan research) | [doc](https://docs.google.com/document/d/10pBHOYPpkOx4H7koCq8klXpEdaWV_Gz6DHMtDe3K6DQ/edit) | `10pBHOYPpkOx4H7koCq8klXpEdaWV_Gz6DHMtDe3K6DQ` |
| Slack #pharmpharm | — | channel `C0CBNTK9JKF` |

**Three ways to read them:**

1. **Google Drive connector** — `read_file_content` with the file ID (`includeComments: true` for the Doc's comment threads); `get_file_metadata` shows `modifiedTime` to see whether anything changed. Caveat: for spreadsheets it returns only a sample of rows per tab — fine for structure, not for full data.
2. **Full CSV export, no auth** (sheets are link-shared) — one tab per request:
   ```
   curl -sL "https://docs.google.com/spreadsheets/d/1v_qiewpx1Yu5fdVaZEFhIwcEWev0IwfiZZbC5Sqf_ZM/gviz/tq?tqx=out:csv&sheet=05_Drug_Class_Assessment"
   ```
   English tab names: `01_Evidence`, `02_Additional_Features`, `03_Core_Assessment`, `04_CKD_Symptoms`, `05_Drug_Class_Assessment`, `07_Risk_Response`, `08_MVP_Scope`, `09_Validation_Limits` (no 06). Korean tabs: `01_근거문헌`, `02_추가기능`, `03_공통사정`, `04_CKD증상`, `05_약물군별사정`, `07_위험대응`, `08_MVP범위`, `09_검증한계`. **Exact names only** — an unknown name silently returns the first tab (check the header row).
3. **Local copies** in `data/team-inputs/` (snapshots, may be stale):
   - `assessment_05_drug_class_EN.csv` — 42 combination rules (DDI001–030 + T001–012), exported Sat 17:15
   - `ckd_ddi_pairs_updated_english.csv` / `.xlsx` — Dohyeon's 30 pairwise rules
   - `ckd_triple_drug_v2.csv` / `.xlsx` — Dohyeon's 12 triple rules (latest); `ckd_triple_drug_interactions.*` is the older version
   - `virtual_patient_A.md` — patient A transcribed (the docx stores it as images)
   - `speaker_script_morning.md` — Hajin's morning check-in script (KR + EN)
   - `ckd_current_situation_and_patient_simulation.docx` — Dohyeon's original (stats + patient case as images)

**Slack files from Dohyeon** (re-download with the Slack connector `slack_read_file`): pairwise `F0CCNRTRL3S` · triples `F0CBD4FES4X` · patient-simulation docx `F0CBN8V0MJ7` (images — prefer `virtual_patient_A.md`). Older versions: `F0CBD2S0ALX`, `F0CBSF3KBF0`, `F0CBD1GMXAB`, `F0CBU7FBJMQ`.

Read-only: never edit the team Doc/Sheets or post in Slack without Eldar's OK.
