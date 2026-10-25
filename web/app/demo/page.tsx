"use client";
import Link from "next/link";
import { act, post, useAppState } from "../client";

// Hajin's morning script first, then other branches.
const CANNED = ["Yes, I just took it with some water", "I feel a little dizzy when I stand up", "Yes, I felt dizzy before taking it", "Yes", "No",
  "Around eight o'clock", "2", "1", "It's worse than yesterday", "About the same",
  "I didn't take it, I ran out", "I forgot", "I bought a painkiller at the pharmacy", "I have chest pain",
  "I'm seeing my doctor tomorrow", "The doctor gave me something for my knee pain", "Yes, that's right"];
const SCREENS = [["Speaker", "/speaker"], ["Caregiver", "/caregiver"], ["Doctor", "/doctor"], ["Pre-visit report", "/report"]];
const btn = "rounded-lg px-4 py-2 font-medium border border-slate-300 bg-white hover:bg-slate-100";

export default function Demo() {
  const s = useAppState();
  if (!s) return null;
  const pending = s.doses.find((d) => d.taken_status === "pending");

  return (
    <main className="max-w-3xl mx-auto p-8 space-y-6">
      <header className="flex justify-between items-baseline">
        <h1 className="text-2xl font-semibold">Demo control</h1>
        <p className="font-mono text-lg">{s.now.replace("T", " ")}</p>
      </header>

      <section className="flex flex-wrap gap-2">
        <button className={btn} onClick={() => act({ type: "fire", slot: "morning" })}>Fire morning 08:00</button>
        <button className={btn} onClick={() => act({ type: "fire", slot: "evening" })}>Fire evening 20:00</button>
        <button className={btn} onClick={() => act({ type: "skip" })} disabled={!s.lastReminderAt}>Skip silence</button>
        <button className={btn} onClick={() => act({ type: "sendReport" })}>Send pre-visit report</button>
        <button className={`${btn} text-red-700`} onClick={() => act({ type: "reset" })}>Reset</button>
      </section>

      <section className="rounded-xl bg-white border border-slate-200 p-4 text-sm space-y-1">
        <p>Pending dose: <b>{pending ? `${pending.slot}, reminder ${pending.reminders}/2` : "none"}</b></p>
        <p>Current question: <b>{s.dialog.current ?? "none"}</b>{s.dialog.queue.length > 0 && ` · queued ${s.dialog.queue.join(", ")}`}</p>
        <p>Flags: {s.flags.length} · open alerts: {s.alerts.filter((a) => !a.ack).length}</p>
        <p>Last speaker line: “{s.transcript.findLast((t) => t.who === "ai")?.text ?? "…"}”</p>
        {s.transcript.findLast((t) => t.who === "patient")?.by && <p>Last answer parsed by: <b>{s.transcript.findLast((t) => t.who === "patient")!.by}</b></p>}
      </section>

      <section>
        <h2 className="font-semibold mb-2">Patient says (backup if the mic fails)</h2>
        <div className="flex flex-wrap gap-2">{CANNED.map((t) => <button key={t} className={btn} onClick={() => post("/api/utterance", { text: t })}>“{t}”</button>)}</div>
      </section>

      <section className="flex flex-wrap gap-6 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" checked={s.fullCheckin} onChange={(e) => act({ type: "settings", fullCheckin: e.target.checked })} /> Full assessment (A02, A06–A10); off = Hajin&apos;s short script</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={s.useLLM} onChange={(e) => act({ type: "settings", useLLM: e.target.checked })} /> Claude extraction (off = offline keywords)</label>
        <label className="flex items-center gap-2">Speaker language
          <select value={s.lang} onChange={(e) => act({ type: "settings", lang: e.target.value })} className="rounded border px-2 py-1">
            <option value="en">English</option><option value="ko">한국어</option>
          </select></label>
      </section>

      <section>
        <h2 className="font-semibold mb-2">Screens</h2>
        <div className="flex flex-wrap gap-2">{SCREENS.map(([label, href]) => <Link key={href} href={href} target="_blank" className={btn}>{label}</Link>)}</div>
      </section>
    </main>
  );
}
