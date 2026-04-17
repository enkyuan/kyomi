"use client";

type ReaderMode = "original" | "extracted";

export function ReaderModeToggle({
  mode,
  onModeChange,
  canUseExtracted,
}: {
  mode: ReaderMode;
  onModeChange: (mode: ReaderMode) => void;
  canUseExtracted: boolean;
}) {
  return (
    <div className="not-prose inline-flex items-center gap-1 rounded-md border border-border p-1">
      <button
        type="button"
        onClick={() => onModeChange("original")}
        className={`rounded px-2.5 py-1 text-xs transition-colors ${
          mode === "original"
            ? "bg-foreground text-background"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        Original
      </button>
      <button
        type="button"
        onClick={() => onModeChange("extracted")}
        disabled={!canUseExtracted}
        className={`rounded px-2.5 py-1 text-xs transition-colors ${
          mode === "extracted"
            ? "bg-foreground text-background"
            : "text-muted-foreground hover:text-foreground"
        } disabled:cursor-not-allowed disabled:opacity-50`}
      >
        Extracted
      </button>
    </div>
  );
}
