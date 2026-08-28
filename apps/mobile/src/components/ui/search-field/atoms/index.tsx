import { Host, TextInput, type TextInputRef, useNativeState } from "@expo/ui";
import { useEffect, useImperativeHandle, useRef } from "react";
import { FONT_STYLES } from "@/theme/fonts";
import {
  INPUT_COLOR,
  PLACEHOLDER_COLOR,
  type SearchFieldProps,
  type SearchFieldRef,
} from "../types";

/** Universal fallback; iOS and Android resolve to their native platform hosts. */
export function SearchField({
  accessibilityLabel: _accessibilityLabel,
  editable = true,
  inputRef,
  onChangeText,
  placeholder,
  value,
}: SearchFieldProps) {
  const text = useNativeState(value);
  const fieldRef = useRef<TextInputRef>(null);

  useImperativeHandle(
    inputRef,
    () => ({
      focus: () => {
        void fieldRef.current?.focus();
      },
    }),
    [],
  );

  useEffect(() => {
    if (text.value !== value) {
      text.value = value;
    }
  }, [text, value]);

  return (
    <Host style={{ flex: 1, height: "100%" }}>
      <TextInput
        autoCapitalize="none"
        autoCorrect={false}
        cursorColor={INPUT_COLOR}
        editable={editable}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={PLACEHOLDER_COLOR}
        ref={fieldRef}
        returnKeyType="search"
        selectionColor={INPUT_COLOR}
        style={{
          height: "100%",
          paddingHorizontal: 16,
          paddingVertical: 0,
        }}
        textStyle={{ ...FONT_STYLES.bodyMedium, color: INPUT_COLOR }}
        value={text}
      />
    </Host>
  );
}

export type { SearchFieldProps, SearchFieldRef } from "../types";
