import { connection } from "next/server";
import { getState, tick } from "@/lib/store";

export async function GET() {
  await connection(); // always live state, never prerendered
  const s = getState();
  tick(s);
  return Response.json(s);
}
