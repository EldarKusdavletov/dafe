# Virtual patient A (Dohyeon Kang, UUCM) — transcribed from "cdk current situation and patient simulation.docx"

Fictional prescriptions built for the hackathon demo; not recommended prescribing.

Goal: merge drugs prescribed by 3 departments; the AI finds a same-ingredient duplicate and a dangerous interaction.

- 76-year-old male, CKD G3b
- eGFR 38 mL/min/1.73m² · creatinine 1.8 mg/dL · serum K+ 4.7 mmol/L · BP 138/82 mmHg
- Conditions: CKD, type 2 diabetes, hypertension, dyslipidemia, knee osteoarthritis
- Departments: nephrology (신장내과), endocrinology (내분비내과), orthopedics (정형외과)

| # | Ingredient (dose) | When | Prescribed by |
|---|---|---|---|
| 1 | Losartan 50 mg | morning 08:00 | nephrology |
| 2 | Amlodipine 5 mg | morning 08:00 | nephrology |
| 3 | Furosemide 20 mg | morning 08:00 | nephrology |
| 4 | Dapagliflozin 10 mg | morning 08:00 | nephrology |
| 5 | Metformin 500 mg | after breakfast and dinner | endocrinology |
| 6 | Linagliptin 5 mg | morning 08:00 | endocrinology |
| 7 | Atorvastatin 20 mg | evening 20:00 | endocrinology |
| 8 | Amlodipine 5 mg | evening 20:00 | endocrinology |
| 9 | Ibuprofen 400 mg | after breakfast and dinner | orthopedics |
| 10 | Acetaminophen 500 mg | as needed for pain | orthopedics |

## Planted risks

1. **Same-ingredient duplicate — amlodipine**: nephrology 5 mg morning + endocrinology 5 mg evening = 10 mg/day; if unintended → hypotension, dizziness, peripheral edema.
   AI alert: "The same ingredient was prescribed by different departments. Please confirm whether this dose is intended."
2. **Triple whammy**: losartan (ARB) + furosemide (diuretic) + ibuprofen (NSAID) → acute kidney injury risk.
   AI alert: "A three-drug combination that may increase acute kidney injury risk in a CKD patient was found. Clinician medication review is needed."

## Context slides from the same doc (for the pitch, sources as cited there)

- Adult CKD prevalence 6.3% (2024, age-standardized), ~25% in 70+; ESKD 130k+ (2023); CKD care cost KRW 2.39T (2021) — KSN 2026 fact sheet, KDCA, NHIS
- 10+ drugs long-term: 1.439M people in 2025 (82.1% aged 65+, ~1.182M), +54.3% vs 2020; NHIS medication-management program reached ~0.8% — NHIS data via an Oct 2026 news report
- OECD 2025: Korea among countries where >63% of people 75+ take 5+ drugs
- CKD patients 118k → 282k and costs KRW 1.17T → 2.39T (2011–2021)
