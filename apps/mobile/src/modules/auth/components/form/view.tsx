import { kyomiNativeBrand } from "@kyomi/ui/native/theme";
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

import { authLayoutTokens } from "../tokens";
import type { AuthActionModel, AuthFieldModel, AuthScreenModel } from "../model";

function NativeAction({ action }: { action: AuthActionModel }) {
  return (
    <Pressable
      accessibilityRole="button"
      className="flex-row items-center justify-center gap-2 rounded-[14px] min-h-[50px] px-[18px] bg-matcha"
      disabled={!action.enabled}
      onPress={action.onPress}
      style={({ pressed }) => [
        pressed && action.enabled ? styles.pressed : null,
        !action.enabled ? styles.disabled : null,
      ]}
    >
      {action.pending ? (
        <ActivityIndicator color={kyomiNativeBrand.matcha.onColor} size="small" />
      ) : null}
      <Text className="text-matcha-foreground text-[15px] font-sans-semibold">
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
      className="justify-center min-h-[40px]"
      disabled={!action.enabled}
      onPress={action.onPress}
    >
      <Text
        className={`text-white text-sm font-sans-semibold${!action.enabled ? " opacity-50" : ""}`}
      >
        {action.label}
      </Text>
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
    <SafeAreaView className="flex-1 bg-black">
      <ScrollView
        contentContainerClassName="flex-grow items-center px-6 py-10"
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
      >
        <View className="gap-5 max-w-[440px] w-full">
          <View className="flex-row items-center gap-[10px]">
            <KyomiIcon size={24} />
            <Text className="text-white text-2xl font-sans-bold tracking-[-0.5px]">Kyomi</Text>
          </View>

          <View className="gap-1.5">
            <Text
              accessibilityRole="header"
              className="text-white text-[32px] font-sans-bold tracking-[-0.7px]"
            >
              {model.title}
            </Text>
            <Text className="text-[#a0a19a] text-base leading-[23px]">{model.description}</Text>
          </View>

          {model.busyIndicator ? (
            <View className="flex-row items-center gap-2">
              <ActivityIndicator color={kyomiNativeBrand.matcha.color} />
              <Text className="text-[#a0a19a] text-base leading-[23px]">Loading…</Text>
            </View>
          ) : null}

          {model.status ? (
            <Text
              accessibilityLiveRegion="polite"
              className={`text-sm leading-5 ${
                model.status.kind === "error"
                  ? "text-[#ff8a82]"
                  : model.status.kind === "success"
                    ? "text-matcha"
                    : "text-[#a0a19a]"
              }`}
            >
              {model.status.message}
            </Text>
          ) : null}

          {model.fields?.map((field) => (
            <View className="gap-[6px]" key={field.id}>
              <Text className="text-white text-sm font-sans-medium">{field.label}</Text>
              <TextInput
                accessibilityLabel={field.label}
                autoCapitalize="none"
                autoComplete={field.autoComplete}
                autoCorrect={false}
                className={`bg-[rgba(255,255,255,0.06)] border rounded-[14px] text-white text-base min-h-[50px] px-[14px] ${
                  field.error ? "border-[#ff8a82]" : "border-[rgba(255,255,255,0.12)]"
                }`}
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
                placeholderTextColor="#a0a19a"
                ref={(value) => {
                  refs.current[field.id] = value ?? undefined;
                }}
                secureTextEntry={field.secure}
                selectionColor={kyomiNativeBrand.matcha.color}
                value={field.value.value}
              />
              {field.error ? (
                <Text className="text-[#ff8a82] text-sm leading-5">{field.error}</Text>
              ) : null}
            </View>
          ))}

          {model.auxiliary ? (
            <View className="items-start">
              <TextAction action={model.auxiliary} />
            </View>
          ) : null}

          {model.primary ? <NativeAction action={model.primary} /> : null}

          {model.note ? (
            <Text className="text-[#a0a19a] text-base leading-[23px]">{model.note}</Text>
          ) : null}

          {model.footer ? (
            <View className="flex-row flex-wrap items-center gap-1">
              {model.footer.prompt ? (
                <Text className="text-[#a0a19a] text-base leading-[23px]">
                  {model.footer.prompt}
                </Text>
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
  pressed: {
    transform: [{ scale: 0.96 }],
  },
  disabled: {
    opacity: 0.48,
  },
});
