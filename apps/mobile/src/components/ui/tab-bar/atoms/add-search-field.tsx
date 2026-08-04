import { type RefObject } from "react";
import { Platform, Pressable, TextInput, View } from "react-native";
import { CloseCircleIcon, SearchIcon } from "@/components/icons";
import { kyomiNativeBrand } from "@kyomi/ui/native/theme";
import type { AddTabBarConfig } from "../add-mode";
import { styles } from "../lib/styles";

export function AddSearchField({
  config,
  inactiveColor,
  inputRef,
}: {
  readonly config: AddTabBarConfig;
  readonly inactiveColor: string;
  readonly inputRef: RefObject<TextInput | null>;
}) {
  return (
    <View style={styles.readerSearchField}>
      <SearchIcon fill={inactiveColor} size={18} />
      <TextInput
        accessibilityLabel="Search feeds"
        autoCapitalize="none"
        autoCorrect={false}
        clearButtonMode="while-editing"
        onChangeText={config.onQueryChange}
        placeholder="Search feeds or paste a URL"
        placeholderTextColor="#71717a"
        ref={inputRef}
        returnKeyType="search"
        selectionColor={kyomiNativeBrand.mizu.color}
        style={styles.readerSearchInput}
        value={config.query}
      />
      {Platform.OS === "android" && config.query ? (
        <Pressable
          accessibilityLabel="Clear feed search"
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => config.onQueryChange("")}
          style={styles.readerSearchClearAction}
        >
          <CloseCircleIcon fill={inactiveColor} size={18} />
        </Pressable>
      ) : null}
    </View>
  );
}
