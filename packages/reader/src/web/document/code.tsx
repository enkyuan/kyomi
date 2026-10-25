"use client";

import { cn } from "@kyomi/ui/lib/utils";
import { Fragment, useEffect, useMemo, useRef, type CSSProperties } from "react";
import type { ReaderBlock } from "../../core/document";
import { mountCopyButton, unmountCopyButton } from "../lib/code-copy-button";

type CodeBlockModel = Extract<ReaderBlock, { type: "code" }>;
type Token = readonly [string, number];
type TokenStyle = NonNullable<CodeBlockModel["highlight"]>["styles"][number];

const HEX_COLOR_RE = /^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i;
const FONT_ITALIC = 1;
const FONT_BOLD = 2;
const FONT_UNDERLINE = 4;

function safeColor(value: string | undefined): string | undefined {
  return value && HEX_COLOR_RE.test(value) ? value : undefined;
}

/**
 * Stored tokens when they reproduce `value` exactly, else one plain line per source line, so a
 * stale or hand-edited highlight can never change the code a reader copies or reads.
 */
function resolveLines(block: CodeBlockModel): readonly (readonly Token[])[] {
  const lines = block.highlight?.lines;
  if (
    lines &&
    lines.map((line) => line.map(([text]) => text).join("")).join("\n") === block.value
  ) {
    return lines;
  }
  return block.value.split("\n").map((line): readonly Token[] => [[line, 0]]);
}

function TokenSpan({ text, style }: { text: string; style: TokenStyle }) {
  const light = safeColor(style.light);
  const dark = safeColor(style.dark);
  const fontStyle = style.fontStyle ?? 0;
  return (
    <span
      className={cn(
        "reader-token",
        fontStyle & FONT_ITALIC && "italic",
        fontStyle & FONT_BOLD && "font-bold",
        fontStyle & FONT_UNDERLINE && "underline",
      )}
      style={{ "--rt-light": light, "--rt-dark": dark } as CSSProperties}
    >
      {text}
    </span>
  );
}

/**
 * Fenced code rendered from stored dual-theme tokens: no highlighter ships to the client. The
 * wrapper reuses the HTML reader's `data-reader-code-block` markup and the vanilla DOM copy
 * button, so both paths share one design.
 */
export function CodeBlock({ block, id }: { block: CodeBlockModel; id: string | undefined }) {
  const copyHostRef = useRef<HTMLDivElement | null>(null);
  const lines = useMemo(() => resolveLines(block), [block]);
  const highlighted = useMemo(() => new Set(block.highlightLines), [block.highlightLines]);
  const styles = block.highlight?.styles;

  useEffect(() => {
    const host = copyHostRef.current;
    if (!host || !block.value.trim()) {
      return;
    }
    mountCopyButton(host, block.value);
    return () => unmountCopyButton(host);
  }, [block.value]);

  const title = block.filename ?? block.label;
  return (
    <div data-reader-code-block="" data-reader-language={block.language ?? undefined} id={id}>
      <div
        aria-label={
          block.filename
            ? `Code sample (${block.filename}, ${block.label})`
            : `Code sample (${block.label})`
        }
        className="reader-code-chrome"
        role="group"
      >
        <span
          className={cn("reader-code-lang-label", block.filename && "reader-code-filename")}
          title={block.filename}
        >
          {title}
        </span>
        <div className="reader-code-copy-host" ref={copyHostRef} />
      </div>
      <pre className="reader-code-pre">
        <code className={cn("hljs", block.language && `language-${block.language}`)}>
          {lines.map((line, index) => (
            <Fragment key={index}>
              <span
                className="reader-code-line"
                data-highlighted={highlighted.has(index + 1) ? "" : undefined}
              >
                {line.map(([text, styleIndex], tokenIndex) => {
                  const style = styleIndex > 0 ? styles?.[styleIndex] : undefined;
                  return style ? (
                    <TokenSpan key={tokenIndex} style={style} text={text} />
                  ) : (
                    <Fragment key={tokenIndex}>{text}</Fragment>
                  );
                })}
              </span>
              {index < lines.length - 1 ? "\n" : null}
            </Fragment>
          ))}
        </code>
      </pre>
    </div>
  );
}
