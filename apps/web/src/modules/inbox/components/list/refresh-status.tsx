"use client";

import { AnimatePresence, LazyMotion, domAnimation, m, type Variants } from "motion/react";
import { useEffect, useRef, useState } from "react";

const RELATIVE_TIME_FORMATTER = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

export function RefreshStatus({
  isRefreshing,
  dataUpdatedAt,
}: {
  isRefreshing: boolean;
  dataUpdatedAt?: number;
}) {
  const [isVisible, setIsVisible] = useState(() => {
    if (isRefreshing) return true;
    if (dataUpdatedAt && Date.now() - dataUpdatedAt < 30000) return true;
    return false;
  });

  const [tick, setTick] = useState(0);

  const [prevRefreshing, setPrevRefreshing] = useState(isRefreshing);
  const [prevDataUpdatedAt, setPrevDataUpdatedAt] = useState(dataUpdatedAt);

  // In-render state adjustment to avoid useEffect state sync warnings
  if (isRefreshing !== prevRefreshing || dataUpdatedAt !== prevDataUpdatedAt) {
    setPrevRefreshing(isRefreshing);
    setPrevDataUpdatedAt(dataUpdatedAt);

    if (isRefreshing) {
      setIsVisible(true);
    } else {
      const didFinishRefresh = prevRefreshing === true;
      const didDataUpdate = dataUpdatedAt !== undefined && dataUpdatedAt !== prevDataUpdatedAt;
      if (didFinishRefresh || didDataUpdate) {
        setIsVisible(true);
      }
    }
  }

  const hideTimeoutRef = useRef<number | null>(null);

  // Handle visibility timeout as a clean side effect
  useEffect(() => {
    if (hideTimeoutRef.current) {
      window.clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }

    if (isVisible && !isRefreshing) {
      hideTimeoutRef.current = window.setTimeout(() => {
        setIsVisible(false);
      }, 6000);
    }

    return () => {
      if (hideTimeoutRef.current) {
        window.clearTimeout(hideTimeoutRef.current);
      }
    };
  }, [isVisible, isRefreshing, dataUpdatedAt]);

  // Update relative time description every 15 seconds while visible
  useEffect(() => {
    if (!isVisible || isRefreshing || !dataUpdatedAt) return;
    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, 15000);
    return () => clearInterval(interval);
  }, [isVisible, isRefreshing, dataUpdatedAt]);

  const relativeText = (() => {
    void tick;
    if (!dataUpdatedAt) return "Updated now";
    const diffMs = Date.now() - dataUpdatedAt;
    const diffMinutes = Math.floor(diffMs / 60000);
    if (diffMinutes <= 0) {
      return "Updated now";
    }
    return `Updated ${RELATIVE_TIME_FORMATTER.format(-diffMinutes, "minute")}`;
  })();

  const ENTER_EASE = [0.32, 0.72, 0, 1] as const;
  const EXIT_EASE = [0.7, 0, 0.84, 0] as const;

  const variants: Variants = {
    initial: { opacity: 0, scale: 0.96 },
    animate: {
      opacity: 1,
      scale: 1,
      transition: {
        opacity: { duration: 0.4, ease: ENTER_EASE },
        scale: { duration: 0.4, ease: ENTER_EASE },
      },
    },
    exit: {
      opacity: 0,
      scale: 0.96,
      transition: {
        opacity: { duration: 0.3, ease: EXIT_EASE },
        scale: { duration: 0.3, ease: EXIT_EASE },
      },
    },
  };

  const pulseVariants: Variants = {
    initial: { opacity: 0.6 },
    animate: {
      opacity: [0.6, 1, 0.6],
      transition: {
        repeat: Infinity,
        duration: 1.5,
        ease: "easeInOut",
      },
    },
  };

  return (
    <LazyMotion features={domAnimation}>
      <AnimatePresence>
        {isVisible && (
          <m.span
            key="refresh-status-root"
            variants={variants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="inline-flex items-center"
          >
            <span
              aria-hidden="true"
              className="shrink-0 text-muted-foreground/50 mx-1.5 select-none"
            >
              ·
            </span>
            <span className="font-medium tracking-[0.01em] text-muted-foreground/85 text-xs select-none">
              <AnimatePresence mode="wait">
                {isRefreshing ? (
                  <m.span
                    key="updating"
                    variants={pulseVariants}
                    initial="initial"
                    animate="animate"
                    className="inline-flex font-medium text-muted-foreground text-sm tabular-nums"
                  >
                    Updating
                  </m.span>
                ) : (
                  <m.span
                    key="updated"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="inline-flex font-medium text-muted-foreground text-sm tabular-nums"
                  >
                    {relativeText}
                  </m.span>
                )}
              </AnimatePresence>
            </span>
          </m.span>
        )}
      </AnimatePresence>
    </LazyMotion>
  );
}
