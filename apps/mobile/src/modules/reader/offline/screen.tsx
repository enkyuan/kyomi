import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Button, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { createActiveTimer, createReadingSession } from "@kyomi/reader/core";
import {
  editFlags,
  editProgress,
  pagePosition,
  pages,
  type OfflineArticle,
} from "@kyomi/reader/offline";
import { queryClient } from "@lib/query/client";
import { library, offlineOwner, syncLibrary } from "@lib/offline/library";

function PageControls({
  count,
  index,
  move,
}: {
  count: number;
  index: number;
  move: (page: number) => Promise<void>;
}) {
  return (
    <>
      {!!count && (
        <Text className="text-foreground">
          Page {index + 1} of {count}
        </Text>
      )}
      <View>
        {index > 0 && <Button title="Previous" onPress={() => void move(index - 1)} />}
        {index + 1 < count && <Button title="Next" onPress={() => void move(index + 1)} />}
      </View>
    </>
  );
}

export default function OfflineReader() {
  const owner = offlineOwner();
  const [rows, setRows] = useState<OfflineArticle[]>([]);
  const [pageOverride, setPageOverride] = useState<number>();
  const remember =
    queryClient.getQueryData<{ rememberPosition?: boolean }>(["me", "preferences"])
      ?.rememberPosition !== false;
  const [selected, setSelected] = useState<string>();
  const [message, setMessage] = useState("");
  const ref = useRef<ScrollView>(null);
  const timer = useRef(createActiveTimer());
  const session = useRef<ReturnType<typeof createReadingSession> | null>(null);
  const reload = useCallback(async () => {
    const saved = owner ? await library.list(owner) : [];
    if (owner === offlineOwner()) setRows(saved.filter((row) => row.saved));
  }, [owner]);
  useEffect(() => {
    void reload().catch(() => setMessage("Could not open the offline library."));
    const sub = AppState.addEventListener("change", (state) =>
      timer.current.setVisible(state === "active"),
    );
    return () => sub.remove();
  }, [reload]);
  const row = rows.find((item) => item.id === selected);
  const parts = pages(row?.document?.text ?? "");
  const index =
    pageOverride ??
    (remember ? Math.round((row?.position ?? 0) * Math.max(0, parts.length - 1)) : 0);
  const edit = async (action: () => Promise<void>) => {
    try {
      await action();
      await reload();
      if (owner)
        void syncLibrary(owner)
          .then(() => setMessage(""))
          .catch(() => setMessage("Changes saved on this device."));
    } catch {
      setMessage("Could not save on this device.");
    }
  };
  const move = (page: number) =>
    edit(async () => {
      if (!owner || !row || !session.current) return;
      timer.current.markActivity();
      session.current.sample({
        progress: pagePosition(page, parts.length),
        completed: page === parts.length - 1,
      });
      const update = session.current.takeUpdate();
      setPageOverride(page);
      if (update && remember) await editProgress(library, owner, row.id, update);
      ref.current?.scrollTo({ y: 0, animated: false });
    });
  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView ref={ref} contentContainerStyle={{ padding: 20, gap: 12 }}>
        <Button
          title={row ? "All saved articles" : "Back"}
          onPress={() =>
            row ? setSelected(undefined) : router.canGoBack() ? router.back() : router.replace("/")
          }
        />
        <Text accessibilityRole="header" className="text-2xl font-semibold text-foreground">
          {row?.document?.title ?? "Offline Read Later"}
        </Text>
        {Boolean(message) && (
          <Text accessibilityLiveRegion="polite" className="text-foreground">
            {message}
          </Text>
        )}
        {owner && row ? (
          <>
            <Text selectable className="text-lg leading-8 text-foreground">
              {parts[index] ?? "No article text is available on this device."}
            </Text>
            <PageControls count={parts.length} index={index} move={move} />
            <Button
              title={row.read ? "Mark unread" : "Mark read"}
              onPress={() =>
                void edit(() => editFlags(library, owner, row.id, { isRead: !row.read }))
              }
            />
            <Button
              title="Remove from Read Later"
              onPress={() => void edit(() => editFlags(library, owner, row.id, { isSaved: false }))}
            />
          </>
        ) : owner && rows.length ? (
          rows.map((item) => (
            <Button
              key={item.id}
              title={item.document?.title ?? "Waiting for download"}
              onPress={() => {
                setPageOverride(undefined);
                timer.current = createActiveTimer();
                session.current = createReadingSession({
                  contentKey: item.document?.contentKey ?? "offline-text",
                  timer: timer.current,
                });
                setSelected(item.id);
              }}
            />
          ))
        ) : (
          <Text className="text-foreground">No articles saved on this device.</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
