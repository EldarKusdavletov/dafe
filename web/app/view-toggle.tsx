"use client";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";

// Web / Phone view for every screen, remembered per page in this browser.
// Phone view loads the same page in a 390×844 iframe, so the page gets a real phone-width viewport
// (Tailwind breakpoints follow the viewport, not a wrapper div). The framed copy sees it is embedded and renders plainly.
const EVENT = "phone-view";
const subscribe = (cb: () => void) => {
  addEventListener("storage", cb);
  addEventListener(EVENT, cb);
  return () => { removeEventListener("storage", cb); removeEventListener(EVENT, cb); };
};

export function ViewToggle({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const key = `phoneView:${path}`;
  const phone = useSyncExternalStore(subscribe, () => { try { return localStorage.getItem(key) === "1"; } catch { return false; } }, () => false);
  const embedded = useSyncExternalStore(subscribe, () => window.self !== window.top, () => false);
  if (embedded) return children;

  function toggle() {
    try { localStorage.setItem(key, phone ? "0" : "1"); } catch {}
    dispatchEvent(new Event(EVENT));
  }

  return (
    <>
      <button onClick={toggle} aria-pressed={phone} className="hidden sm:block fixed bottom-4 right-4 z-50 rounded-full border border-slate-300 bg-white/90 px-4 py-1.5 text-sm font-medium text-slate-800 shadow">
        {phone ? "Web view" : "Phone view"}
      </button>
      {phone ? (
        <div className="min-h-screen bg-slate-200 flex items-center justify-center p-6">
          <div className="relative rounded-[3rem] bg-slate-900 px-3 pb-3 pt-10 shadow-2xl">
            <div className="absolute left-1/2 top-3 h-5 w-24 -translate-x-1/2 rounded-full bg-black" />
            <iframe src={path} title={`${path} on a phone`} allow="microphone; autoplay" className="block h-[844px] w-[390px] rounded-[2.4rem] bg-white" />
          </div>
        </div>
      ) : children}
    </>
  );
}
