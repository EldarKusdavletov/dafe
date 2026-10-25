import { z } from "zod";
import { answer, currentQuestion } from "@/lib/dialog";
import { extract } from "@/lib/extract";
import { getState } from "@/lib/store";

const Body = z.object({ text: z.string().trim().min(1).max(500) });

export async function POST(req: Request) {
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return Response.json({ error: "text required" }, { status: 400 });
  const s = getState();
  s.transcript.push({ at: s.now, who: "patient", text: body.data.text });
  const { data, by } = await extract(body.data.text, currentQuestion(s), s.useLLM);
  s.transcript.at(-1)!.by = by;
  answer(s, data);
  return Response.json({ extraction: data, by });
}
