import { z } from "zod";

// Meta M2M100 model vocabulary. BCP 47 preferences retain region and script until dispatch.
export const translationLanguages =
  "af am ar ast az ba be bg bn br bs ca ceb cs cy da de el en es et fa ff fi fr fy ga gd gl gu ha he hi hr ht hu hy id ig ilo is it ja jv ka kk km kn ko lb lg ln lo lt lv mg mk ml mn mr ms my ne nl no ns oc or pa pl ps pt ro ru sd si sk sl so sq sr ss su sv sw ta th tl tn tr uk ur uz vi wo xh yi yo zh zu".split(
    " ",
  );

export function modelLanguage(locale: string) {
  try {
    const base = new Intl.Locale(locale).language;
    const code =
      ({ fil: "tl", nso: "ns", nb: "no", nn: "no" } as Record<string, string>)[base] ?? base;
    return translationLanguages.includes(code) ? code : null;
  } catch {
    return null;
  }
}

export const translationResultSchema = z.object({
  id: z.uuid(),
  status: z.enum(["queued", "processing", "failed", "ready"]),
  target_language: z.string(),
  source_language: z.string(),
  translated_content: z.string().nullable(),
  error_code: z.string().nullable(),
});
export type TranslationResult = z.infer<typeof translationResultSchema>;
