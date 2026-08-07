import { BottomSheet, Button, Column, Row, Text, TextInput, useNativeState } from "@expo/ui";
import { useColorScheme } from "react-native";
import { getMobileSurfaceTheme } from "@/theme/surfaces";
import { useCreateFolder } from "../hooks/use-create-folder";
import type { CreateFolderProps } from "../lib/create-folder.types";

const ERROR_COLOR = "#c0392b";

/** Native adaptive naming sheet for the global create-folder action. */
export function CreateFolder({ isPresented, onDismiss }: CreateFolderProps) {
  const theme = getMobileSurfaceTheme(useColorScheme());
  const name = useNativeState("");
  const form = useCreateFolder({ isPresented, name, onDismiss });

  return (
    <BottomSheet isPresented={isPresented} onDismiss={form.handleDismiss}>
      <Column alignment="start" spacing={20} style={{ paddingBottom: 12, width: "100%" }}>
        <Column alignment="start" spacing={6} style={{ width: "100%" }}>
          <Text textStyle={{ color: theme.foreground, fontSize: 22, fontWeight: "600" }}>
            Create folder
          </Text>
          <Text textStyle={{ color: theme.mutedForeground, fontSize: 15, lineHeight: 21 }}>
            Name a folder to organize your feeds.
          </Text>
        </Column>

        <Column alignment="start" spacing={8} style={{ width: "100%" }}>
          <TextInput
            autoCapitalize="words"
            autoFocus={isPresented}
            autoCorrect
            editable={!form.isCreating}
            onChangeText={form.handleNameChange}
            onSubmitEditing={() => void form.handleSubmit()}
            placeholder="Folder name"
            placeholderTextColor={theme.mutedForeground}
            returnKeyType="done"
            selectionColor={theme.foreground}
            style={{
              backgroundColor: theme.input,
              borderColor: form.nameError ? ERROR_COLOR : "transparent",
              borderRadius: 14,
              borderWidth: 1,
              paddingHorizontal: 14,
              paddingVertical: 13,
              width: "100%",
            }}
            textStyle={{ color: theme.foreground, fontSize: 17 }}
            value={name}
          />
          {form.nameError ? (
            <Text textStyle={{ color: ERROR_COLOR, fontSize: 13 }}>{form.nameError}</Text>
          ) : null}
        </Column>

        <Row alignment="center" spacing={10} style={{ width: "100%" }}>
          <Button
            disabled={form.isCreating}
            label="Cancel"
            onPress={form.handleDismiss}
            style={{ width: "48%" }}
            variant="outlined"
          />
          <Button
            disabled={form.isCreating}
            label={form.isCreating ? "Creating…" : "Create folder"}
            onPress={() => void form.handleSubmit()}
            style={{ width: "48%" }}
          />
        </Row>
      </Column>
    </BottomSheet>
  );
}
