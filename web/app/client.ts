"use client";
import { useEffect, useState } from "react";
import type { State } from "@/lib/store";

export type { State };

// shortcut: 1 s polling, fine for one laptop; switch to server-sent events if screens run on many devices.
export function useAppState() {
  const [s, setS] = useState<State | null>(null);
  useEffect(() => {
    let on = true;
    const load = () => fetch("/api/state").then((r) => r.json()).then((x) => on && setS(x)).catch(() => {});
    load();
    const t = setInterval(load, 1000);
    return () => { on = false; clearInterval(t); };
  }, []);
  return s;
}

export const post = (url: string, body: unknown) =>
  fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
export const act = (body: { type: string } & Record<string, unknown>) => post("/api/action", body);

export const fmt = (at: string) => `${at.slice(5, 10).replace("-", "/")} ${at.slice(11, 16)}`;
