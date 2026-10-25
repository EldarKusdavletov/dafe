import { z } from "zod";
import { prescriptionRead } from "@/lib/dialog";
import { readPrescription } from "@/lib/extract";
import { getState } from "@/lib/store";

// After-visit scenario: the speaker page uploads a prescription photo (data URL, downscaled in the browser).
const Body = z.object({
  image: z.string().max(12_000_000).regex(/^data:image\/(jpeg|png);base64,/),
  sampleText: z.string().max(2000).default(""), // only the built-in sample photo sends its text (offline fallback)
});

export async function POST(req: Request) {
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return Response.json({ error: "a JPEG or PNG data URL is required" }, { status: 400 });
  const s = getState();
  const [head, base64] = body.data.image.split(",");
  const mediaType = head.includes("png") ? "image/png" : "image/jpeg";
  s.transcript.push({ at: s.now, who: "patient", text: "(sent a photo of the prescription)" });
  const known = [...new Set([...Object.keys(s.drugClasses), ...s.meds.map((m) => m.ingredient)])];
  const { drugs, by } = await readPrescription({ mediaType, base64 }, s.useLLM, body.data.sampleText, known);
  s.transcript.at(-1)!.by = by;
  prescriptionRead(s, drugs);
  return Response.json({ drugs, by });
}
