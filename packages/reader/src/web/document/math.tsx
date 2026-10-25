"use client";

import { useMemo } from "react";
import { sanitizeReaderArticleHtml } from "../html/purify";
import { useHydrated } from "../hooks/use-hydrated";
import { isTrustedKatexHtml } from "./lib";

type MathFields = {
  tex?: string | undefined;
  mathml?: string | undefined;
  rendered?: string | undefined;
};

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
