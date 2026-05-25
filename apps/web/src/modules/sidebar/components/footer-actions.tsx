"use client";

import { Suspense, useState } from "react";
import { ArrowUpCircleFill, Chat3Fill, Settings3Fill } from "@mingcute/react";
import { SidebarModeAnimatedText } from "@vols.rss/ui/sidebar/mode-animated-text";
import {
  SidebarFooter,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@vols.rss/ui/sidebar";
import { lazyNamed } from "@lib/lazy-named";

const FeedbackDialog = lazyNamed(() => import("@vols.rss/ui/feedback-dialog"), "FeedbackDialog");

const FOOTER_ICONS = {
  upgrade: ArrowUpCircleFill,
  feedback: Chat3Fill,
  settings: Settings3Fill,
} as const;

const FOOTER_NAV = [
  { label: "Upgrade Plan", iconKey: "upgrade" as const },
  { label: "Feedback", iconKey: "feedback" as const },
  { label: "Settings", iconKey: "settings" as const },
];

export function FooterActions({ onOpenSettings }: { onOpenSettings: () => void }) {
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackDialogLoaded, setFeedbackDialogLoaded] = useState(false);

  const preloadFeedbackDialog = () => {
    setFeedbackDialogLoaded(true);
    void FeedbackDialog.preload();
  };

  return (
    <SidebarFooter className="px-2 pb-2 pt-0">
      <SidebarMenu>
        {FOOTER_NAV.map((item) => {
          const Icon = FOOTER_ICONS[item.iconKey];
          const isSettings = item.label === "Settings";
          const isUpgrade = item.label === "Upgrade Plan";

          return (
            <SidebarMenuItem key={item.label}>
              {item.label === "Feedback" ? (
                <>
                  <SidebarMenuButton
                    tooltip={item.label}
                    className="opacity-72"
                    onClick={() => {
                      preloadFeedbackDialog();
                      setFeedbackOpen(true);
                    }}
                    onFocus={preloadFeedbackDialog}
                    onPointerEnter={preloadFeedbackDialog}
                  >
                    <Icon />
                    <SidebarModeAnimatedText>{item.label}</SidebarModeAnimatedText>
                  </SidebarMenuButton>
                  <Suspense fallback={null}>
                    {feedbackDialogLoaded ? (
                      <FeedbackDialog
                        hideTrigger
                        open={feedbackOpen}
                        onOpenChange={setFeedbackOpen}
                      />
                    ) : null}
                  </Suspense>
                </>
              ) : (
                <SidebarMenuButton
                  tooltip={item.label}
                  className="opacity-72"
                  disabled={isUpgrade}
                  onClick={isSettings ? onOpenSettings : undefined}
                >
                  <Icon />
                  <SidebarModeAnimatedText>{item.label}</SidebarModeAnimatedText>
                </SidebarMenuButton>
              )}
            </SidebarMenuItem>
          );
        })}
      </SidebarMenu>
    </SidebarFooter>
  );
}
