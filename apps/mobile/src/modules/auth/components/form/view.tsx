import { kyomiNativeBrand, kyomiNativeColors } from "@kyomi/ui/native/theme";
import { useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInput as TextInputHandle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { KyomiIcon } from "@/components/icons";

import { authFallbackColors, authLayoutTokens } from "../tokens";
import type { AuthActionModel, AuthFieldModel, AuthScreenModel } from "../model";

function NativeAction({ action }: { action: AuthActionModel }) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={!action.enabled}
      onPress={action.onPress}
      style={({ pressed }) => [
        styles.button,
        styles.primaryButton,
        pressed && action.enabled ? styles.pressed : null,
        !action.enabled ? styles.disabled : null,
      ]}
    >
      {action.pending ? (
        <ActivityIndicator color={kyomiNativeBrand.matcha.onColor} size="small" />
      ) : null}
      <Text style={styles.primaryButtonText}>
        {action.pending ? (action.pendingLabel ?? action.label) : action.label}
      </Text>
    </Pressable>
  );
}

function TextAction({
  action,
}: {
  action: { label: string; enabled: boolean; onPress: () => void };
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={!action.enabled}
      onPress={action.onPress}
      style={styles.textAction}
    >
      <Text style={[styles.link, !action.enabled ? styles.disabled : null]}>{action.label}</Text>
    </Pressable>
  );
}

export function AuthScreenView({ model }: { model: AuthScreenModel }) {
  const refs = useRef<Partial<Record<AuthFieldModel["id"], TextInputHandle>>>({});

  useEffect(() => {
    const request = model.focusRequest;
    if (request) {
      refs.current[request.field]?.focus();
    }
  }, [model.focusRequest]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.content}>
          <View style={styles.brand}>
            <KyomiIcon size={24} />
            <Text style={styles.wordmark}>Kyomi</Text>
          </View>

          <View style={styles.heading}>
            <Text accessibilityRole="header" style={styles.title}>
              {model.title}
            </Text>
            <Text style={styles.description}>{model.description}</Text>
          </View>

          {model.busyIndicator ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={kyomiNativeBrand.matcha.color} />
              <Text style={styles.description}>Loading…</Text>
            </View>
          ) : null}

          {model.status ? (
            <Text
              accessibilityLiveRegion="polite"
              style={[
                styles.status,
                model.status.kind === "error"
                  ? styles.error
                  : model.status.kind === "success"
                    ? styles.success
                    : null,
              ]}
            >
              {model.status.message}
            </Text>
          ) : null}

          {model.fields?.map((field) => (
            <View key={field.id} style={styles.field}>
              <Text style={styles.label}>{field.label}</Text>
              <TextInput
                accessibilityLabel={field.label}
                autoCapitalize="none"
                autoComplete={field.autoComplete}
                autoCorrect={false}
                editable={field.enabled}
                keyboardAppearance="dark"
                keyboardType={field.id === "email" ? "email-address" : "default"}
                onBlur={field.onBlur}
                onChangeText={(value) => {
                  field.value.value = value;
                  field.onChange(value);
                }}
                onSubmitEditing={field.onSubmit}
                placeholder={field.placeholder}
                placeholderTextColor={authFallbackColors.mutedText}
                ref={(value) => {
                  refs.current[field.id] = value ?? undefined;
                }}
                secureTextEntry={field.secure}
                selectionColor={kyomiNativeBrand.matcha.color}
                style={[styles.input, field.error ? styles.inputError : null]}
                value={field.value.value}
              />
              {field.error ? <Text style={styles.error}>{field.error}</Text> : null}
            </View>
          ))}

          {model.auxiliary ? (
            <View style={styles.leadingAction}>
              <TextAction action={model.auxiliary} />
            </View>
          ) : null}

          {model.primary ? <NativeAction action={model.primary} /> : null}

          {model.note ? <Text style={styles.description}>{model.note}</Text> : null}

          {model.footer ? (
            <View style={styles.footer}>
              {model.footer.prompt ? (
                <Text style={styles.description}>{model.footer.prompt}</Text>
              ) : null}
              <TextAction action={model.footer.action} />
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: kyomiNativeColors.black,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: "center",
    paddingHorizontal: authLayoutTokens.screenHorizontalPadding,
    paddingVertical: authLayoutTokens.screenVerticalPadding,
  },
  content: {
    gap: authLayoutTokens.contentGap,
    maxWidth: authLayoutTokens.contentMaxWidth,
    width: "100%",
  },
  brand: {
    alignItems: "center",
    flexDirection: "row",
    gap: authLayoutTokens.brandGap,
  },
  wordmark: {
    color: authFallbackColors.text,
    fontSize: 24,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  heading: {
    gap: 6,
  },
  title: {
    color: authFallbackColors.text,
    fontSize: 32,
    fontWeight: "700",
    letterSpacing: -0.7,
  },
  description: {
    color: authFallbackColors.mutedText,
    fontSize: 16,
    lineHeight: 23,
  },
  loadingRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  status: {
    color: authFallbackColors.mutedText,
    fontSize: 14,
    lineHeight: 20,
  },
  error: {
    color: authFallbackColors.error,
  },
  success: {
    color: kyomiNativeBrand.matcha.color,
  },
  field: {
    gap: authLayoutTokens.fieldGap,
  },
  label: {
    color: authFallbackColors.text,
    fontSize: 14,
    fontWeight: "500",
  },
  input: {
    backgroundColor: authFallbackColors.inputSurface,
    borderColor: authFallbackColors.outline,
    borderRadius: authLayoutTokens.controlRadius,
    borderWidth: 1,
    color: authFallbackColors.text,
    fontSize: 16,
    minHeight: authLayoutTokens.controlMinHeight,
    paddingHorizontal: 14,
  },
  inputError: {
    borderColor: authFallbackColors.error,
  },
  button: {
    alignItems: "center",
    borderRadius: authLayoutTokens.controlRadius,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    minHeight: authLayoutTokens.controlMinHeight,
    paddingHorizontal: 18,
  },
  primaryButton: {
    backgroundColor: kyomiNativeBrand.matcha.color,
  },
  primaryButtonText: {
    color: kyomiNativeBrand.matcha.onColor,
    fontSize: 15,
    fontWeight: "600",
  },
  pressed: {
    transform: [{ scale: 0.96 }],
  },
  disabled: {
    opacity: 0.48,
  },
  leadingAction: {
    alignItems: "flex-start",
  },
  textAction: {
    justifyContent: "center",
    minHeight: 40,
  },
  link: {
    color: authFallbackColors.text,
    fontSize: 14,
    fontWeight: "600",
  },
  footer: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    justifyContent: "flex-start",
  },
});
