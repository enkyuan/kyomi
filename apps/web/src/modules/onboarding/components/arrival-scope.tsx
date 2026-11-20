import { useRouterState } from "@tanstack/react-router";
import { accentChain } from "glimm";
import { GlimmScope, type GlimmScopeHandle } from "glimm/react";
import { useRef, useState, type PropsWithChildren } from "react";
import { InboxArrivalTransition } from "../lib/arrival-transition";

const palette = accentChain(["#7775E8", "#AE73DC", "#E5A1A9"]);

export function ArrivalScope({ children }: PropsWithChildren) {
  const onboarding = useRouterState({
    select: (state) => state.location.pathname === "/onboarding",
  });
  const scope = useRef<GlimmScopeHandle>(null);
  const [playing, setPlaying] = useState(false);
  const [captureReady, setCaptureReady] = useState(false);
  const active = onboarding || playing;

  function play<T>(
    work: () => Promise<T>,
    change: (result: T) => Promise<void>,
    at?: [number, number],
  ) {
    const transition = scope.current;
    if (!transition) return work().then(change);

    return new Promise<void>((resolve, reject) => {
      transition.play({
        work,
        at,
        change: (result) => change(result).then(resolve, reject),
        onFail: reject,
        onLeave: () => setPlaying(false),
      });
      setPlaying(true);
    });
  }

  return (
    <InboxArrivalTransition.Provider value={{ play, setCaptureReady }}>
      <GlimmScope
        ref={scope}
        style={active ? { height: "100dvh" } : { overflow: "visible" }}
        pageEffect={active && (captureReady || playing)}
        direction="rtl"
        palette={palette}
        sweepMs={1100}
        brightness={0.85}
        peakAlpha={0.85}
      >
        {/* Composite translucent controls over the theme background inside the captured page. */}
        <div className={active ? "h-full overflow-y-auto bg-background" : undefined}>
          {children}
        </div>
      </GlimmScope>
    </InboxArrivalTransition.Provider>
  );
}
