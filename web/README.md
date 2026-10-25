# Dafe: team PharmPharm prototype

Kidney-aware medication safety for older adults with CKD. Hackathon prototype, fake data only.

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # rule engine + keyword fallback
npm run demo       # production build served to the local Wi-Fi: http://<laptop IP>:3000
```

For phones on networks that block device-to-device traffic, add an HTTPS tunnel (new random URL each run; anyone with the link can use the demo, so stop it after):
`~/.local/share/cloudflared-2026.10.3/cloudflared tunnel --no-autoupdate --url http://localhost:3000`

Use `npm run demo` for phones and on stage. Dev mode works on `localhost` but reload-loops when opened by LAN IP. Find the IP with `ipconfig getifaddr en0`. Phones can't use the microphone over plain `http` (browsers only allow it on `localhost` or HTTPS), so on a phone the speaker works with the typed box.

Claude extraction runs through your Claude Pro login (Claude Code must be logged in: `claude` → `/login`). No API key is used. If Claude is slow or offline, untick "Claude extraction" on `/demo` and the keyword matcher takes over.

## Data = the team's sheets

`npm run sync` downloads every tab of the team's assessment sheets (EN + KO) into `data/team/`. Then press Reset on `/demo` and the app reloads from them; no rebuild is needed. The drug–drug rules come from `05_Drug_Class_Assessment`, and symptom names from `04_CKD_Symptoms`. Patient A (drugs, departments, labs) is in `data/seed.json`, transcribed from `data/team-inputs/virtual_patient_A.md`. The local placeholders (eGFR rule, thresholds) are in `data/rules.json`, and the speaker lines in `data/questions.json`.

## Demo: the team's 4 situations (~90 s)

Open `/demo` and launch the screens from there. On `/speaker`, tap "Start speaker" once so the browser is allowed to talk.

1. **Daily monitoring** (Hajin's morning script). Fire morning, then on `/speaker`: "Yes, I just took it with some water" → "I feel a little dizzy when I stand up" → "Yes, I felt dizzy before taking it" → the speaker asks the triple-whammy rule's question → "Yes". The doctor and the caregiver get a T02 alert.
2. **At the clinic visit**, on `/doctor`: the medication safety review shows the triple whammy (losartan + furosemide + ibuprofen), the amlodipine duplicate from two departments, and the eGFR placeholder flag. It also has the trends and the summary.
3. **After the visit**: on `/doctor`, add spironolactone. It is flagged against losartan (DDI005), and the speaker gives a neutral notice only. Stopping ibuprofen clears the triple.
4. **Family**: fire evening, then Skip silence twice. The missed-dose alert appears on `/caregiver`.

Every screen has a "Phone view" button at the bottom right that shows it in a phone frame; the choice is remembered per page.

Reset between runs.

**The team Doc's two other scenarios:**
- **Clinic visit:** the patient says "I'm seeing my doctor tomorrow" (or press "Send pre-visit report" on `/demo`). The doctor gets a "Pre-visit report ready" alert. `/report` is the report-style document: what to decide, DRPs, medicines, adherence, symptoms, measurements and caregiver notes, built only from recorded data.
- **After the visit** (Hajin's script, softened): the patient says "The doctor gave me something for my knee pain", and the speaker asks for a photo of the prescription. Use "Take a photo of the prescription" (camera on a phone) or "Use sample prescription". Claude reads the drug names; the offline fallback works for the sample only. The speaker then asks "I found a medicine called ibuprofen. Is that the name on your prescription?" On "Yes" the drug is added and the rules rerun. If a kidney-related rule involves the drug, the speaker says it "may affect kidney function… please check with your doctor before taking the new medicine", and the doctor gets a "New prescription (photo)" alert.

The speaker covers every scenario in the sheets. By default it follows Hajin's short script (A01 → A04 → A05 → rule question). With "Full assessment" ticked on `/demo` it asks the whole tab-03 set: A02 time if taken, A03 reason if not taken (tailored reply, never a dose change), and A05–A10 if symptomatic. Those questions are worded from the sheet in EN or KO. Closing lines follow tab 06: T01 emergency, T02 (rule answer "yes", urgent signs, or dizziness worse than yesterday) means consult promptly and alert the doctor and caregiver, and T03 means rest and call if it continues.
