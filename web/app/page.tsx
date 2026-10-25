import Link from "next/link";

const SCREENS = [
  ["/speaker", "AI speaker", "Older adult: reminders and check-in questions by voice"],
  ["/caregiver", "Caregiver app", "Family or care worker: missed-dose alerts and visit reports (Web / Phone view toggle)"],
  ["/doctor", "Doctor", "DRP review across departments, pre-visit AI report and trends"],
  ["/report", "Pre-visit report", "Report for the doctor before a visit, built from recorded data"],
  ["/demo", "Demo control", "Clock, reminders, reset"],
];

export default function Home() {
  return (
    <main className="max-w-2xl mx-auto p-10">
      <h1 className="text-3xl font-semibold">Dafe</h1>
      <p className="mt-1 text-slate-600">AI voice agent that prevents drug-related problems (DRPs) in older adults with CKD and polypharmacy. Team PharmPharm prototype, fake data.</p>
      <ul className="mt-8 grid gap-3">
        {SCREENS.map(([href, title, sub]) => (
          <li key={href}><Link href={href} className="block rounded-xl border border-slate-200 bg-white p-4 hover:border-slate-400">
            <b>{title}</b><span className="block text-sm text-slate-500">{sub}</span></Link></li>
        ))}
      </ul>
    </main>
  );
}
