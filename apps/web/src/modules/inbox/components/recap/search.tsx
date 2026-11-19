"use client";

import { SearchIcon } from "@kyomi/ui/icons/blode";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@kyomi/ui/components/input-group";
import { Kbd, KbdGroup } from "@kyomi/ui/components/kbd";
import { isPlatformModifierShortcut, usePlatform } from "@hooks/use-platform";
import { useSquircle } from "@kyomi/ui/lib/squircle";
import { useEffect } from "react";

/**
 * Concentric with the rail: the field sits 8px in from the edge of the rail, so its corner is 8px.
 * Its content follows the same rule: the shortcut chip (20px tall in a 40px field) sits 10px from
 * the edge on every side, with a 6px corner.
 */
const RECAP_SEARCH_RADIUS_PX = 8;

/**
 * The field at the top of the rail, with its shortcut inset at the end (⌘K on macOS, ⌃K elsewhere).
 * It is the way into the command menu: clicking or focusing it, or the shortcut from anywhere,
 * opens the menu, where the typing happens. It shows the active article search, if there is one.
 */
export function RecapSearch({ value, onOpen }: { value: string | undefined; onOpen: () => void }) {
  const platform = usePlatform();
  const squircle = useSquircle<HTMLDivElement>(RECAP_SEARCH_RADIUS_PX, 1);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.key.toLowerCase() !== "k" ||
        !isPlatformModifierShortcut(event, platform) ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      event.preventDefault();
      onOpen();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-doctor/prefer-use-effect-event
  }, [onOpen, platform]);

  return (
    <div className="shrink-0 px-2">
      <InputGroup
        ref={squircle.ref}
        className="h-10 rounded-none border-0 bg-foreground/6 shadow-none ring-0 transition-colors before:hidden has-[input:focus-visible]:bg-foreground/10 has-[input:focus-visible]:ring-0 dark:bg-foreground/6 dark:before:hidden dark:has-[input:focus-visible]:bg-foreground/10"
        style={squircle.style}
      >
        <InputGroupAddon className="ps-3">
          <SearchIcon />
        </InputGroupAddon>
        <InputGroupInput
          aria-haspopup="dialog"
          aria-keyshortcuts={`${platform.usesMetaModifier ? "Meta" : "Control"}+K`}
          aria-label="Search"
          className="cursor-pointer"
          placeholder="Search"
          readOnly
          value={value ?? ""}
          onClick={onOpen}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onOpen();
            }
          }}
        />
        {/* The addon pulls a trailing <kbd> 0.35rem outward; here the chip's own 10px inset is the rule. */}
        <InputGroupAddon align="inline-end" className="pe-2.5 has-[>kbd:last-child]:me-0">
          <KbdGroup aria-hidden="true">
            <Kbd className="rounded-md">{platform.modifierKeyLabel}</Kbd>
            <Kbd className="rounded-md">K</Kbd>
          </KbdGroup>
        </InputGroupAddon>
      </InputGroup>
    </div>
  );
}
