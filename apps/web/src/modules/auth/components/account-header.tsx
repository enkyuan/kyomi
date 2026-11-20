import { Button } from "@kyomi/ui/components/button";
import { KyomiLogo } from "@kyomi/ui/icons";
import { ArrowUndoUpIcon } from "@kyomi/ui/icons/blode";

export function AccountHeader({ onBack }: { onBack?: () => void }) {
  return (
    <header className="absolute inset-x-6 top-6 flex h-7 items-center gap-3 sm:inset-x-10 sm:top-8">
      {onBack && (
        <Button variant="ghost" className="-ms-3 min-h-11" onClick={onBack}>
          <ArrowUndoUpIcon aria-hidden="true" className="rtl:-scale-x-100" />
          Back
        </Button>
      )}
      <KyomiLogo
        size={28}
        className="ms-auto size-7 shrink-0 text-matcha"
        fill="currentColor"
        role="img"
        aria-label="Kyomi"
        aria-hidden={false}
      />
    </header>
  );
}
