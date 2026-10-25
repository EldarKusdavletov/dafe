"use client";
import { useEffect, useRef, useState } from "react";
import { post, useAppState } from "../client";

type Rec = {
  lang: string; interimResults: boolean; start(): void;
  onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
  onend: () => void; onerror: () => void;
};
type RecCtor = new () => Rec;

export default function Speaker() {
  const s = useAppState();
  const [on, setOn] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [listening, setListening] = useState(false);
  const [text, setText] = useState("");
  const spoken = useRef(-1);
  const lang = s?.lang === "ko" ? "ko-KR" : "en-US";

  // Speak every new AI line once; history from before the speaker was switched on stays silent.
  useEffect(() => {
    if (!s || !on) return;
    if (spoken.current < 0 || spoken.current > s.transcript.length) spoken.current = s.transcript.length;
    const fresh = s.transcript.slice(spoken.current).filter((t) => t.who === "ai");
    spoken.current = s.transcript.length;
    for (const t of fresh) {
      const u = new SpeechSynthesisUtterance(t.text);
      u.lang = lang;
      u.voice = speechSynthesis.getVoices().find((v) => v.lang === lang) ?? null;
      u.rate = 0.95;
      u.onstart = () => setSpeaking(true);
      u.onend = () => setSpeaking(speechSynthesis.pending);
      speechSynthesis.speak(u);
    }
  }, [s, on, lang]);

  const [thinking, setThinking] = useState(false);
  async function send(t: string) {
    if (!t.trim()) return;
    setThinking(true);
    await post("/api/utterance", { text: t.trim() }).finally(() => setThinking(false));
  }

  function listen() {
    const w = window as unknown as { SpeechRecognition?: RecCtor; webkitSpeechRecognition?: RecCtor };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) return alertNoStt();
    speechSynthesis.cancel();
    const r = new Ctor();
    r.lang = lang;
    r.interimResults = false;
    r.onresult = (e) => send(e.results[0][0].transcript);
    r.onend = r.onerror = () => setListening(false);
    setListening(true);
    r.start();
  }
  const alertNoStt = () => setText("Speech recognition needs Chrome. Type instead.");

  // After-visit scenario: prescription photo, downscaled in the browser so the upload stays small.
  async function sendPhoto(image: string, sampleText = "") {
    setThinking(true);
    await post("/api/prescription", { image, sampleText }).finally(() => setThinking(false));
  }
  async function fromFile(file: File) {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const c = Object.assign(document.createElement("canvas"), { width: Math.round(bmp.width * k), height: Math.round(bmp.height * k) });
    c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
    sendPhoto(c.toDataURL("image/jpeg", 0.85));
  }
  // Fake sample prescription for the demo video (no real clinic, doctor or brand).
  const SAMPLE = ["Clinic C (fake) · Orthopedics", "PRESCRIPTION", "Patient: Mrs. Kim (virtual), 78 F", "Date: 2026-10-25", "Rx: Ibuprofen 400 mg tablet", "1 tablet twice a day after meals, 7 days", "For: knee pain", "Doctor: Dr. Example (fake)"];
  function sample() {
    const c = Object.assign(document.createElement("canvas"), { width: 900, height: 1100 });
    const g = c.getContext("2d")!;
    g.fillStyle = "#ffffff"; g.fillRect(0, 0, 900, 1100);
    g.fillStyle = "#111827";
    SAMPLE.forEach((t, i) => { g.font = i === 1 ? "bold 56px Arial" : i === 4 ? "bold 40px Arial" : "34px Arial"; g.fillText(t, 70, 120 + i * 110); });
    sendPhoto(c.toDataURL("image/png"), SAMPLE.join("\n"));
  }

  const lastAi = s?.transcript.findLast((t) => t.who === "ai");
  const lastMe = s?.transcript.findLast((t) => t.who === "patient");

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-900 to-indigo-950 text-white flex flex-col items-center px-6 py-8">
      <div className="flex items-center gap-2 text-sm text-indigo-200">
        <span className="rounded-full bg-indigo-500/30 px-3 py-1 font-semibold tracking-wide">AI</span>
        {s?.lang === "ko" ? "AI 복약 도우미" : "AI medication assistant"} · {s?.now.slice(11, 16)}
      </div>

      <button
        onClick={listen}
        disabled={!on || listening || thinking}
        aria-label={listening ? "Listening" : "Tap to talk"}
        className={`mt-12 h-48 w-48 rounded-full transition-all flex items-center justify-center text-lg font-medium
          ${listening ? "bg-rose-500 scale-110 shadow-[0_0_80px_rgba(244,63,94,0.6)]" :
            speaking ? "bg-indigo-400 animate-pulse shadow-[0_0_80px_rgba(129,140,248,0.7)]" : "bg-indigo-600 shadow-[0_0_40px_rgba(79,70,229,0.4)]"}`}
      >
        {listening ? "Listening…" : thinking ? "Thinking…" : speaking ? "Speaking" : "Tap to talk"}
      </button>

      <p className="mt-12 max-w-xl text-center text-3xl leading-snug font-medium min-h-24">{lastAi?.text ?? "…"}</p>
      {lastMe && <p className="mt-4 text-indigo-200 text-lg">You: “{lastMe.text}”</p>}

      {s?.dialog.current === "RX_PHOTO" && (
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <label className="cursor-pointer rounded-xl bg-white px-5 py-3 font-semibold text-indigo-950 focus-within:ring-2 ring-indigo-300">
            Take a photo of the prescription
            <input type="file" accept="image/*" capture="environment" className="sr-only" disabled={thinking}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) fromFile(f); e.target.value = ""; }} />
          </label>
          <button onClick={sample} disabled={thinking} className="rounded-xl bg-white/15 px-5 py-3 font-medium hover:bg-white/25">Use sample prescription</button>
        </div>
      )}

      <form onSubmit={(e) => { e.preventDefault(); send(text); setText(""); }} className="mt-auto w-full max-w-xl flex gap-2 pt-10">
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Or type the answer…" aria-label="Typed answer"
          className="flex-1 rounded-xl bg-white/10 px-4 py-3 placeholder:text-indigo-300 outline-none focus:ring-2 ring-indigo-400" />
        <button className="rounded-xl bg-white/15 px-5 font-medium hover:bg-white/25">Send</button>
      </form>

      {!on && (
        <button onClick={() => { speechSynthesis.speak(new SpeechSynthesisUtterance("")); setOn(true); }}
          className="fixed inset-0 bg-slate-950/90 flex flex-col items-center justify-center gap-3 text-2xl">
          <span className="rounded-full bg-indigo-600 px-8 py-4 font-semibold">Start speaker</span>
          <span className="text-sm text-slate-400">Browsers need one tap before they can talk</span>
        </button>
      )}
    </main>
  );
}
