"use client";

import { useMemo } from "react";
import { sanitizeReaderArticleHtml } from "../html/purify";
import { useHydrated } from "../hooks/use-hydrated";

type MathFields = {
  tex?: string | undefined;
  mathml?: string | undefined;
  rendered?: string | undefined;
};

/**
 * `rendered` is KaTeX output the compiler produced with `trust: false`. It is injected as-is, so
 * anything that is not plain KaTeX markup (scripts, frames, event handlers) is refused and the
 * math falls back to its source instead.
 */
const UNSAFE_RENDERED_RE =
  /<\s*(?:script|iframe|object|embed|link|style|base|form)\b|\son[a-z]+\s*=|javascript:/i;

export function isTrustedKatexHtml(html: string): boolean {
  return !UNSAFE_RENDERED_RE.test(html);
}

function useSanitizedMathml(mathml: string | undefined): string | null {
  const hydrated = useHydrated();
  return useMemo(
    () => (hydrated && mathml ? sanitizeReaderArticleHtml(mathml) : null),
    [hydrated, mathml],
  );
}

function MathContent({ math, display }: { math: MathFields; display: boolean }) {
  const rendered = math.rendered && isTrustedKatexHtml(math.rendered) ? math.rendered : null;
  const mathml = useSanitizedMathml(rendered ? undefined : math.mathml);
  const Tag = display ? "div" : "span";

  if (rendered) {
    return (
      <Tag
        data-reader-math={display ? "block" : "inline"}
        dangerouslySetInnerHTML={{ __html: rendered }}
      />
    );
  }
  if (mathml) {
    return (
      <Tag
        data-reader-math={display ? "block" : "inline"}
        dangerouslySetInnerHTML={{ __html: mathml }}
      />
    );
  }
  return math.tex ? (
    <Tag data-reader-math={display ? "block" : "inline"}>
      <code>{math.tex}</code>
    </Tag>
  ) : null;
}

export function InlineMath({ math }: { math: MathFields }) {
  return <MathContent display={false} math={math} />;
}

export function BlockMath({ math }: { math: MathFields }) {
  return <MathContent display math={math} />;
}
