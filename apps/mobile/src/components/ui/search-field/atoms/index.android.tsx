import ClearSymbol from "@expo/material-symbols/cancel.xml";
import {
  BasicTextField,
  Box,
  Host,
  Icon,
  IconButton,
  Row,
  type BasicTextFieldRef,
  Text,
  useNativeState,
} from "@expo/ui/jetpack-compose";
import {
  fillMaxHeight,
  fillMaxWidth,
  padding,
  size,
  weight,
} from "@expo/ui/jetpack-compose/modifiers";
import { useEffect, useImperativeHandle, useRef } from "react";
import {
  INPUT_COLOR,
  PLACEHOLDER_COLOR,
  SEARCH_FIELD_HEIGHT,
  type SearchFieldProps,
  type SearchFieldRef,
} from "../types";

/** Compose-backed search field with a native clear affordance and text layout. */
export function SearchField({
  accessibilityLabel,
  clearAccessibilityLabel,
  editable = true,
  inputRef,
  onChangeText,
  placeholder,
  value,
}: SearchFieldProps) {
  const text = useNativeState(value);
  const fieldRef = useRef<BasicTextFieldRef>(null);

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

  const clear = () => {
    text.value = "";
    onChangeText?.("");
    void fieldRef.current?.focus();
  };

  return (
    <Host ignoreSafeAreaKeyboardInsets style={{ flex: 1, height: "100%" }}>
      <Row
        verticalAlignment="center"
        modifiers={[fillMaxWidth(), fillMaxHeight(), padding(16, 0, 6, 0)]}
      >
        <BasicTextField
          ref={fieldRef}
          cursorColor={INPUT_COLOR}
          enabled={editable}
          keyboardOptions={{
            capitalization: "none",
            autoCorrectEnabled: false,
            imeAction: "search",
          }}
          onValueChange={onChangeText}
          singleLine
          textStyle={{ color: INPUT_COLOR, fontSize: 15, lineHeight: 20 }}
          textSelectionColors={{
            backgroundColor: "#f4f4f566",
            handleColor: INPUT_COLOR,
          }}
          value={text}
          modifiers={[weight(1), fillMaxHeight()]}
        >
          <BasicTextField.DecorationBox>
            <Box contentAlignment="centerStart" modifiers={[fillMaxWidth(), fillMaxHeight()]}>
              <BasicTextField.Placeholder>
                <Text color={PLACEHOLDER_COLOR} style={{ fontSize: 15, lineHeight: 20 }}>
                  {placeholder}
                </Text>
              </BasicTextField.Placeholder>
              <BasicTextField.InnerTextField />
            </Box>
          </BasicTextField.DecorationBox>
        </BasicTextField>
        <IconButton
          enabled={Boolean(value)}
          onClick={clear}
          colors={{
            containerColor: "transparent",
            contentColor: PLACEHOLDER_COLOR,
            disabledContainerColor: "transparent",
            disabledContentColor: "transparent",
          }}
          modifiers={[size(44, 44)]}
        >
          <Icon
            contentDescription={clearAccessibilityLabel}
            size={18}
            source={ClearSymbol}
            tint={PLACEHOLDER_COLOR}
          />
        </IconButton>
      </Row>
    </Host>
  );
}

export type { SearchFieldProps, SearchFieldRef } from "../types";
