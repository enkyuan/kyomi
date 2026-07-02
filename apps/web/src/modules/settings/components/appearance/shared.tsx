"use client";

export function SettingHeading({ description, title }: { description: string; title: string }) {
  return (
    <div className="space-y-1">
      <p className="text-md font-medium text-foreground">{title}</p>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

export function SettingSubHeading({ description, title }: { description: string; title: string }) {
  return (
    <div className="space-y-1">
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  );
}
