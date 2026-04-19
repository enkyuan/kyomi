"use client";

import { CheckFill, Copy2Fill } from "@mingcute/react";
import { useCallback, useState } from "react";
import { cn } from "@lib/utils";

export function ArticleCodeCopyButton({ text }: { text: string }) {
  const [isCopied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }, [text]);

  return (
    <button
      type="button"
      className="reader-code-copy-button"
      onClick={handleCopy}
      aria-label={isCopied ? "Copied" : "Copy code"}
    >
      <div className="relative size-4 shrink-0">
        <div
          className={cn(
            "absolute inset-0 flex items-center justify-center transition-[opacity,filter,scale] duration-300 ease-in-out will-change-[opacity,filter,scale]",
            isCopied ? "scale-100 opacity-100 blur-0" : "scale-[0.25] opacity-0 blur-[3px]",
          )}
        >
          <CheckFill className="size-4" />
        </div>
        <div
          className={cn(
            "absolute inset-0 flex items-center justify-center transition-[opacity,filter,scale] duration-300 ease-in-out will-change-[opacity,filter,scale]",
            isCopied ? "scale-[0.25] opacity-0 blur-[3px]" : "scale-100 opacity-100 blur-0",
          )}
        >
          <Copy2Fill className="size-4" />
        </div>
      </div>
    </button>
  );
}
