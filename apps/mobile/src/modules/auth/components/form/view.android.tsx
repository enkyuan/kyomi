import { kyomiNativeBrand, kyomiNativeColors } from "@kyomi/ui/native/theme";
import { Host } from "@expo/ui";
import {
  Button,
  Column,
  LoadingIndicator,
  OutlinedTextField,
  RNHostView,
  Row,
  Shape,
  Text,
  TextButton,
  type TextFieldRef,
  useMaterialColors,
} from "@expo/ui/jetpack-compose";
import {
  align,
  background,
  defaultMinSize,
  fillMaxSize,
  fillMaxWidth,
  imePadding,
  padding,
  size,
  verticalScroll,
} from "@expo/ui/jetpack-compose/modifiers";
import { useEffect, useRef, type ComponentProps } from "react";
import { useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { KyomiIcon } from "@/components/icons";

import { authLayoutTokens } from "../tokens";
import type { AuthActionModel, AuthFieldModel, AuthScreenModel } from "../model";

type ComposeObservableString = NonNullable<ComponentProps<typeof OutlinedTextField>["value"]>;

function actionLabel(action: AuthActionModel) {
  return action.pending ? (action.pendingLabel ?? action.label) : action.label;
}

function NativeAction({ action }: { action: AuthActionModel }) {
  const colors = useMaterialColors();

  return (
    <Button
      enabled={action.enabled}
      modifiers={[fillMaxWidth(), defaultMinSize({ minHeight: authLayoutTokens.controlMinHeight })]}
      onClick={action.onPress}
      shape={Shape.RoundedCorner({
        cornerRadii: {
          topStart: authLayoutTokens.controlRadius,
          topEnd: authLayoutTokens.controlRadius,
          bottomStart: authLayoutTokens.controlRadius,
          bottomEnd: authLayoutTokens.controlRadius,
        },
      })}
    >
      <Row horizontalArrangement={{ spacedBy: 8 }} verticalAlignment="center">
        {action.pending ? (
          <LoadingIndicator color={colors.onPrimary} modifiers={[size(18, 18)]} />
        ) : null}
        <Text style={{ typography: "labelLarge" }}>{actionLabel(action)}</Text>
      </Row>
    </Button>
  );
}

function NativeField({
  field,
  setRef,
}: {
  field: AuthFieldModel;
  setRef: (value: TextFieldRef | null) => void;
}) {
  const colors = useMaterialColors();

  return (
    <OutlinedTextField
      autoFocus={field.autoFocus}
      enabled={field.enabled}
      isError={Boolean(field.error)}
      keyboardActions={field.onSubmit ? { onDone: field.onSubmit } : undefined}
      keyboardOptions={{
        capitalization: "none",
        autoCorrectEnabled: false,
        keyboardType: field.id === "email" ? "email" : "password",
        imeAction: field.onSubmit ? "done" : "next",
      }}
      modifiers={[fillMaxWidth()]}
      onFocusChanged={(focused) => {
        if (!focused) field.onBlur();
      }}
      onValueChange={field.onChange}
      ref={setRef}
      shape={Shape.RoundedCorner({
        cornerRadii: {
          topStart: authLayoutTokens.controlRadius,
          topEnd: authLayoutTokens.controlRadius,
          bottomStart: authLayoutTokens.controlRadius,
          bottomEnd: authLayoutTokens.controlRadius,
        },
      })}
      singleLine
      value={field.value as ComposeObservableString}
      visualTransformation={field.secure ? "password" : "none"}
    >
      <OutlinedTextField.Label>
        <Text>{field.label}</Text>
      </OutlinedTextField.Label>
      <OutlinedTextField.Placeholder>
        <Text>{field.placeholder}</Text>
      </OutlinedTextField.Placeholder>
      {field.error ? (
        <OutlinedTextField.SupportingText>
          <Text color={colors.error}>{field.error}</Text>
        </OutlinedTextField.SupportingText>
      ) : null}
    </OutlinedTextField>
  );
}

export function AuthScreenView({ model }: { model: AuthScreenModel }) {
  const refs = useRef<Partial<Record<AuthFieldModel["id"], TextFieldRef>>>({});
  const { width: windowWidth } = useWindowDimensions();
  const colors = useMaterialColors({
    colorScheme: "dark",
    seedColor: kyomiNativeBrand.matcha.color,
  });
  const contentFraction = Math.min(
    1,
    authLayoutTokens.contentMaxWidth /
      Math.max(windowWidth - authLayoutTokens.screenHorizontalPadding * 2, 1),
  );

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
        <Column
          horizontalAlignment="center"
          modifiers={[
            fillMaxSize(),
            background(kyomiNativeColors.black),
            verticalScroll(),
            imePadding(),
            padding(
              authLayoutTokens.screenHorizontalPadding,
              authLayoutTokens.screenVerticalPadding,
              authLayoutTokens.screenHorizontalPadding,
              authLayoutTokens.screenVerticalPadding,
            ),
          ]}
        >
          <Column
            horizontalAlignment="start"
            modifiers={[fillMaxWidth(contentFraction), align("centerHorizontally")]}
            verticalArrangement={{ spacedBy: authLayoutTokens.contentGap }}
          >
            <Row
              horizontalArrangement={{ spacedBy: authLayoutTokens.brandGap }}
              verticalAlignment="center"
            >
              <RNHostView matchContents>
                <KyomiIcon size={24} />
              </RNHostView>
              <Text
                color={colors.onBackground}
                style={{ typography: "headlineSmall", fontWeight: "700" }}
              >
                Kyomi
              </Text>
            </Row>

            <Column verticalArrangement={{ spacedBy: 6 }}>
              <Text
                color={colors.onBackground}
                style={{ typography: "headlineLarge", fontWeight: "700" }}
              >
                {model.title}
              </Text>
              <Text color={colors.onSurfaceVariant} style={{ typography: "bodyLarge" }}>
                {model.description}
              </Text>
            </Column>

            {model.busyIndicator ? (
              <Row horizontalArrangement={{ spacedBy: 8 }} verticalAlignment="center">
                <LoadingIndicator modifiers={[size(20, 20)]} />
                <Text color={colors.onSurfaceVariant} style={{ typography: "bodyMedium" }}>
                  Loading…
                </Text>
              </Row>
            ) : null}

            {model.status ? (
              <Text
                color={
                  model.status.kind === "error"
                    ? colors.error
                    : model.status.kind === "success"
                      ? colors.primary
                      : colors.onSurfaceVariant
                }
                style={{ typography: "bodyMedium" }}
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
              <Row horizontalArrangement="start" modifiers={[fillMaxWidth()]}>
                <TextButton enabled={model.auxiliary.enabled} onClick={model.auxiliary.onPress}>
                  <Text>{model.auxiliary.label}</Text>
                </TextButton>
              </Row>
            ) : null}

            {model.primary ? <NativeAction action={model.primary} /> : null}

            {model.note ? (
              <Text color={colors.onSurfaceVariant} style={{ typography: "bodyMedium" }}>
                {model.note}
              </Text>
            ) : null}

            {model.footer ? (
              <Row
                horizontalArrangement="start"
                modifiers={[fillMaxWidth()]}
                verticalAlignment="center"
              >
                {model.footer.prompt ? (
                  <Text color={colors.onSurfaceVariant} style={{ typography: "bodyMedium" }}>
                    {model.footer.prompt}
                  </Text>
                ) : null}
                <TextButton
                  enabled={model.footer.action.enabled}
                  onClick={model.footer.action.onPress}
                >
                  <Text>{model.footer.action.label}</Text>
                </TextButton>
              </Row>
            ) : null}
          </Column>
        </Column>
      </Host>
    </SafeAreaView>
  );
}
