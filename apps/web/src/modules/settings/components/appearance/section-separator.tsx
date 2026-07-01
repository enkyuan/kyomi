"use client";

export function SectionSeparator() {
  return (
    <div className="flex justify-center items-center select-none space-y-1" aria-hidden="true">
      <span className="text-muted-foreground/35 font-medium tracking-[0.6em] text-sm ps-[0.6em]">
        ···
      </span>
    </div>
  );
}
