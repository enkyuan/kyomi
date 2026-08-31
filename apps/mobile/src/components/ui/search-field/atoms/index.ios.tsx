import {
  Button,
  Host,
  HStack,
  TextField,
  type TextFieldRef,
  useNativeState,
} from "@expo/ui/swift-ui";
import {
  accessibilityHidden,
  accessibilityLabel,
  autocorrectionDisabled,
  buttonStyle,
  disabled,
  font,
  foregroundStyle,
  frame,
  labelStyle,
  opacity,
  padding,
  submitLabel,
  textFieldStyle,
  textInputAutocapitalization,
  tint,
} from "@expo/ui/swift-ui/modifiers";
import { useEffect, useImperativeHandle, useRef } from "react";
import { FONT_FAMILIES, FONT_SIZES } from "@/theme/fonts";
import {
  INPUT_COLOR,
  PLACEHOLDER_COLOR,
  SEARCH_FIELD_HEIGHT,
  type SearchFieldProps,
  type SearchFieldRef,
} from "../types";

/** SwiftUI-backed search field. Native layout keeps text and placeholder centered. */
export function SearchField({
  accessibilityLabel: fieldAccessibilityLabel,
  clearAccessibilityLabel,
  editable = true,
  inputRef,
  onChangeText,
  placeholder,
  value,
}: SearchFieldProps) {
  const text = useNativeState(value);
  const fieldRef = useRef<TextFieldRef>(null);

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
    if (text.get() !== value) {
      text.set(value);
    }
  }, [text, value]);

  const clear = () => {
    text.set("");
    onChangeText?.("");
    void fieldRef.current?.focus();
  };

  return (
    <Host ignoreSafeArea="all" style={{ flex: 1, height: "100%" }}>
      <HStack
        modifiers={[
          frame({ maxWidth: Infinity, height: SEARCH_FIELD_HEIGHT }),
          padding({ leading: 16, trailing: 6 }),
        ]}
      >
        <TextField
          ref={fieldRef}
          onTextChange={onChangeText}
          placeholder={placeholder}
          text={text}
          modifiers={[
            frame({ maxWidth: Infinity }),
            textFieldStyle("plain"),
            textInputAutocapitalization("never"),
            autocorrectionDisabled(),
            submitLabel("search"),
            font({ family: FONT_FAMILIES.inter.regular, size: FONT_SIZES.bodyMedium }),
            foregroundStyle(INPUT_COLOR),
            tint(INPUT_COLOR),
            accessibilityLabel(fieldAccessibilityLabel),
            ...(editable ? [] : [disabled(true)]),
          ]}
        />
        <Button
          label={clearAccessibilityLabel}
          systemImage="xmark.circle.fill"
          onPress={clear}
          modifiers={[
            buttonStyle("plain"),
            labelStyle("iconOnly"),
            frame({ width: 44, height: 44 }),
            foregroundStyle(PLACEHOLDER_COLOR),
            opacity(value ? 1 : 0),
            disabled(!value),
            accessibilityHidden(!value),
          ]}
        />
      </HStack>
    </Host>
  );
}

export type { SearchFieldProps, SearchFieldRef } from "../types";
