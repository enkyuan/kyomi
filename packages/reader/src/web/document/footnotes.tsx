"use client";

import type { ReaderDocument } from "../../core/document";
import { Blocks } from "./block";
import { anchorId, footnoteRefId, scrollToAnchor } from "./lib";

/** Definitions collected by the compiler, listed after the body with a backlink to each reference. */
export function Footnotes({ footnotes }: { footnotes: ReaderDocument["footnotes"] }) {
  if (footnotes.length === 0) {
    return null;
  }
  return (
    <section aria-label="Footnotes" data-reader-footnotes="">
      <hr />
      <ol className="text-[0.9em]">
        {footnotes.map((footnote) => {
          const id = anchorId(footnote.id);
          const refId = footnoteRefId(footnote.id);
          return (
            <li className="scroll-mt-20" id={id} key={footnote.id}>
              <Blocks blocks={footnote.children} />
              <a
                aria-label={`Back to reference ${footnote.label}`}
                data-reader-footnote-backref=""
                href={`#${refId}`}
                onClick={(event) => scrollToAnchor(event, refId)}
              >
                ↩
              </a>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
