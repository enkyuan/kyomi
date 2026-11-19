"use client";

/** A section of the page (Appearance, Inbox, Account): the largest text in the panel. */
export function SettingHeading({ description, title }: { description: string; title: string }) {
  return (
    <div className="space-y-1">
      <h3 className="font-semibold text-foreground text-lg leading-7">{title}</h3>
      <p className="text-muted-foreground text-sm">{description}</p>
    </div>
  );
}

/** An adjustment inside a section: one step down from the section, and so are its options. */
export function SettingSubHeading({ description, title }: { description: string; title: string }) {
  return (
    <div className="space-y-0.5">
      <p className="font-medium text-foreground text-sm">{title}</p>
      <p className="text-muted-foreground text-xs">{description}</p>
    </div>
  );
}
