"use client";

import { useEffect, useRef } from "react";

/**
 * The folder's name, edited in place: the text itself becomes editable (no input box), marked by a
 * soft highlight and a caret. Enter saves, Escape or clicking away cancels.
 */
export function InlineRename({
  label,
  name,
  onCancel,
  onChange,
  onSubmit,
}: {
  label: string;
  name: string;
  onCancel: () => void;
  onChange: (value: string) => void;
  onSubmit: () => void;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) {
      return;
    }
    node.focus();
    const range = document.createRange();
    range.selectNodeContents(node);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }, []);

  return (
    <span
      ref={ref}
      aria-label={label}
      className="-mx-1.5 min-w-0 flex-1 truncate rounded-md bg-accent/70 px-1.5 py-0.5 text-foreground caret-foreground outline-none ring-1 ring-ring/40 transition-[background-color,box-shadow] duration-150 ease-out focus:ring-2"
      contentEditable="plaintext-only"
      role="textbox"
      suppressContentEditableWarning
      onBlur={onCancel}
      onInput={(event) => onChange(event.currentTarget.textContent ?? "")}
      onKeyDown={(event) => {
        // The menu treats Enter, Escape and the arrows as its own; the name keeps them.
        event.stopPropagation();
        if (event.key === "Enter") {
          event.preventDefault();
          onSubmit();
        }
        if (event.key === "Escape") {
          onCancel();
        }
      }}
    >
      {name}
    </span>
  );
}
