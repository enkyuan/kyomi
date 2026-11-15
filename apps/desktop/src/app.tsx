import { useState } from "react";
import { Button } from "@gpuix/react";
import type { ArticleListItemDto } from "@kyomi/reader/schemas/article";

// GPUI does not inherit `color`; every <text> sets its own.
const colors = {
  background: "#111111",
  surface: "#1a1a1a",
  surfaceHover: "#232323",
  text: "#e8e8e8",
  muted: "#8a8a8a",
};

const sample: Pick<ArticleListItemDto, "id" | "title" | "feedTitle">[] = [
  { id: "1", title: "Welcome to Kyomi desktop", feedTitle: "Kyomi" },
  { id: "2", title: "Rendered by GPUI, written in React", feedTitle: "GPUIX" },
];

export function App() {
  const [selectedId, setSelectedId] = useState(sample[0]?.id);

  return (
    <div
      style={{
        flexDirection: "column",
        gap: 8,
        padding: 24,
        backgroundColor: colors.background,
        height: "100%",
      }}
    >
      <text style={{ color: colors.text, fontSize: 20 }}>Inbox</text>
      {sample.map((item) => (
        <Button
          key={item.id}
          onClick={() => setSelectedId(item.id)}
          style={{
            flexDirection: "column",
            gap: 2,
            padding: 12,
            borderRadius: 8,
            cursor: "pointer",
            backgroundColor: item.id === selectedId ? colors.surfaceHover : colors.surface,
            hover: { backgroundColor: colors.surfaceHover },
          }}
        >
          <text style={{ color: colors.text }}>{item.title}</text>
          <text style={{ color: colors.muted, fontSize: 12 }}>{item.feedTitle}</text>
        </Button>
      ))}
    </div>
  );
}
