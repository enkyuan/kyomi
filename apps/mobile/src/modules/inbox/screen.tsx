import { Host, List } from "@expo/ui";
import { kyomiNativeBrand } from "@kyomi/ui/native/theme";
import { useState } from "react";

import { useReducedMotion } from "@/hooks/use-reduced-motion";

import { inboxPreviewItems } from "./model";
import { InboxRow } from "./row";

export function InboxScreen() {
  const [selectedId, setSelectedId] = useState<string>(inboxPreviewItems[0].id);
  const reducedMotion = useReducedMotion();

  return (
    <Host seedColor={kyomiNativeBrand.matcha.color} style={{ flex: 1 }} useViewportSizeMeasurement>
      <List testID="inbox-list">
        {inboxPreviewItems.map((item) => (
          <InboxRow
            item={item}
            key={item.id}
            onSelect={setSelectedId}
            reducedMotion={reducedMotion}
            selected={item.id === selectedId}
          />
        ))}
      </List>
    </Host>
  );
}
