import { kyomiNativeBrand, kyomiNativeColors } from "@kyomi/ui/native/theme";
import { Host } from "@expo/ui";
import {
  Button,
  HStack,
  ProgressView,
  RNHostView,
  ScrollView,
  SecureField,
  Text,
  TextField,
  VStack,
  type SecureFieldRef,
  type TextFieldRef,
} from "@expo/ui/swift-ui";
import {
  accessibilityLabel,
  autocorrectionDisabled,
  buttonBorderShape,
  buttonStyle,
  controlSize,
  disabled,
  font,
  foregroundStyle,
  frame,
  keyboardType,
  onSubmit,
  padding,
  scrollDismissesKeyboard,
  submitLabel,
  textInputAutocapitalization,
  textContentType,
  textFieldStyle,
} from "@expo/ui/swift-ui/modifiers";
import { useEffect, useRef, type ComponentProps } from "react";
import { PlatformColor } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { KyomiIcon } from "@/components/icons";

import { authLayoutTokens } from "../tokens";
import type { AuthActionModel, AuthFieldModel, AuthScreenModel } from "../model";

type FocusableFieldRef = Pick<TextFieldRef | SecureFieldRef, "focus">;
type SwiftObservableString = NonNullable<ComponentProps<typeof TextField>["text"]>;

function fieldContentType(field: AuthFieldModel) {
  switch (field.autoComplete) {
    case "email":
      return "emailAddress" as const;
    case "current-password":
      return "password" as const;
    case "new-password":
      return "newPassword" as const;
  }
}

function actionLabel(action: AuthActionModel) {
  return action.pending ? (action.pendingLabel ?? action.label) : action.label;
}

function NativeAction({ action }: { action: AuthActionModel }) {
  return (
    <Button
      modifiers={[
        buttonStyle("borderedProminent"),
        buttonBorderShape("roundedRectangle", authLayoutTokens.controlRadius),
        controlSize("large"),
        frame({ minHeight: authLayoutTokens.controlMinHeight, maxWidth: Infinity }),
        disabled(!action.enabled),
      ]}
      onPress={action.onPress}
    >
      <HStack alignment="center" spacing={8}>
        {action.pending ? <ProgressView /> : null}
        <Text modifiers={[font({ textStyle: "body", weight: "semibold" })]}>
          {actionLabel(action)}
        </Text>
      </HStack>
    </Button>
  );
}

function NativeField({
  field,
  setRef,
}: {
  field: AuthFieldModel;
  setRef: (value: FocusableFieldRef | null) => void;
}) {
  const modifiers = [
    textFieldStyle("roundedBorder"),
    textContentType(fieldContentType(field)),
    ...(field.id === "email"
      ? [
          keyboardType("email-address"),
          textInputAutocapitalization("never"),
          autocorrectionDisabled(),
        ]
      : []),
    submitLabel(field.onSubmit ? "done" : "next"),
    ...(field.onSubmit ? [onSubmit(field.onSubmit)] : []),
    accessibilityLabel(field.label),
    disabled(!field.enabled),
  ];

  return (
    <VStack alignment="leading" spacing={6}>
      <Text modifiers={[font({ textStyle: "subheadline", weight: "medium" })]}>{field.label}</Text>
      {field.secure ? (
        <SecureField
          autoFocus={field.autoFocus}
          onFocusChange={(focused) => {
            if (!focused) field.onBlur();
          }}
          onTextChange={field.onChange}
          placeholder={field.placeholder}
          ref={setRef}
          text={field.value as SwiftObservableString}
          modifiers={modifiers}
        />
      ) : (
        <TextField
          autoFocus={field.autoFocus}
          onFocusChange={(focused) => {
            if (!focused) field.onBlur();
          }}
          onTextChange={field.onChange}
          placeholder={field.placeholder}
          ref={setRef}
          text={field.value as SwiftObservableString}
          modifiers={modifiers}
        />
      )}
      {field.error ? (
        <Text
          modifiers={[
            font({ textStyle: "footnote" }),
            foregroundStyle(PlatformColor("systemRed")),
            accessibilityLabel(`Error: ${field.error}`),
          ]}
        >
          {field.error}
        </Text>
      ) : null}
    </VStack>
  );
}

export function AuthScreenView({ model }: { model: AuthScreenModel }) {
  const refs = useRef<Partial<Record<AuthFieldModel["id"], FocusableFieldRef>>>({});

  useEffect(() => {
    const request = model.focusRequest;
    if (request) {
      void refs.current[request.field]?.focus();
    }
  }, [model.focusRequest]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: kyomiNativeColors.black }}>
      <Host
        colorScheme="dark"
        seedColor={kyomiNativeBrand.matcha.color}
        style={{ flex: 1 }}
        useViewportSizeMeasurement
      >
        <ScrollView modifiers={[scrollDismissesKeyboard("interactively")]}>
          <VStack
            alignment="leading"
            modifiers={[
              frame({
                maxWidth: authLayoutTokens.contentMaxWidth,
                minWidth: 0,
                alignment: "leading",
              }),
              padding({
                horizontal: authLayoutTokens.screenHorizontalPadding,
                vertical: authLayoutTokens.screenVerticalPadding,
              }),
            ]}
            spacing={authLayoutTokens.contentGap}
          >
            <HStack alignment="center" spacing={authLayoutTokens.brandGap}>
              <RNHostView matchContents>
                <KyomiIcon size={24} />
              </RNHostView>
              <Text modifiers={[font({ textStyle: "title2", weight: "bold" })]}>Kyomi</Text>
            </HStack>

            <VStack alignment="leading" spacing={6}>
              <Text modifiers={[font({ textStyle: "largeTitle", weight: "bold" })]}>
                {model.title}
              </Text>
              <Text
                modifiers={[
                  font({ textStyle: "body" }),
                  foregroundStyle({ type: "hierarchical", style: "secondary" }),
                ]}
              >
                {model.description}
              </Text>
            </VStack>

            {model.busyIndicator ? (
              <HStack alignment="center" spacing={8}>
                <ProgressView />
                <Text
                  modifiers={[
                    font({ textStyle: "subheadline" }),
                    foregroundStyle({ type: "hierarchical", style: "secondary" }),
                  ]}
                >
                  Loading…
                </Text>
              </HStack>
            ) : null}

            {model.status ? (
              <Text
                modifiers={[
                  font({ textStyle: "subheadline" }),
                  foregroundStyle(
                    model.status.kind === "error"
                      ? PlatformColor("systemRed")
                      : model.status.kind === "success"
                        ? PlatformColor("systemGreen")
                        : { type: "hierarchical", style: "secondary" },
                  ),
                  accessibilityLabel(`${model.status.kind}: ${model.status.message}`),
                ]}
              >
                {model.status.message}
              </Text>
            ) : null}

            {model.fields?.map((field) => (
              <NativeField
                field={field}
                key={field.id}
                setRef={(value) => {
                  refs.current[field.id] = value ?? undefined;
                }}
              />
            ))}

            {model.auxiliary ? (
              <HStack>
                <Button
                  label={model.auxiliary.label}
                  modifiers={[buttonStyle("borderless"), disabled(!model.auxiliary.enabled)]}
                  onPress={model.auxiliary.onPress}
                />
              </HStack>
            ) : null}

            {model.primary ? <NativeAction action={model.primary} /> : null}

            {model.note ? (
              <Text
                modifiers={[
                  font({ textStyle: "subheadline" }),
                  foregroundStyle({ type: "hierarchical", style: "secondary" }),
                ]}
              >
                {model.note}
              </Text>
            ) : null}

            {model.footer ? (
              <HStack alignment="firstTextBaseline" spacing={4}>
                {model.footer.prompt ? (
                  <Text
                    modifiers={[
                      font({ textStyle: "subheadline" }),
                      foregroundStyle({ type: "hierarchical", style: "secondary" }),
                    ]}
                  >
                    {model.footer.prompt}
                  </Text>
                ) : null}
                <Button
                  label={model.footer.action.label}
                  modifiers={[buttonStyle("borderless"), disabled(!model.footer.action.enabled)]}
                  onPress={model.footer.action.onPress}
                />
              </HStack>
            ) : null}
          </VStack>
        </ScrollView>
      </Host>
    </SafeAreaView>
  );
}
