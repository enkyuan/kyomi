import { BottomSheet } from "@expo/ui";
import {
  Box,
  Button,
  CircularProgressIndicator,
  Column,
  OutlinedButton,
  OutlinedTextField,
  Row,
  Shape,
  Text,
  useNativeState,
} from "@expo/ui/jetpack-compose";
import { fillMaxWidth, height, padding, size, weight } from "@expo/ui/jetpack-compose/modifiers";
import { useColorScheme } from "react-native";
import { FONT_STYLES } from "@/theme/fonts";
import { getMobileSurfaceTheme } from "@/theme/surfaces";
import { useCreateFolder } from "../hooks/use-create-folder";
import type { CreateFolderProps } from "../lib/create-folder.types";

const ERROR_COLOR = "#c0392b";
const BUTTON_LABEL_STYLE = FONT_STYLES.button;
const CONTENT_HORIZONTAL_INSET = 24;

/** Material 3 expression of the folder-name sheet. */
export function CreateFolder({ isPresented, onDismiss }: CreateFolderProps) {
  const theme = getMobileSurfaceTheme(useColorScheme());
  const name = useNativeState("");
  const form = useCreateFolder({ isPresented, name, onDismiss });

  return (
    <BottomSheet isPresented={isPresented} onDismiss={form.handleDismiss}>
      <Column horizontalAlignment="start" modifiers={[fillMaxWidth(), padding(0, 24, 0, 24)]}>
        <Column
          horizontalAlignment="start"
          modifiers={[
            fillMaxWidth(),
            padding(CONTENT_HORIZONTAL_INSET, 0, CONTENT_HORIZONTAL_INSET, 0),
          ]}
        >
          <Text color={theme.foreground} style={FONT_STYLES.screenTitle}>
            Create folder
          </Text>
          <Text
            color={theme.mutedForeground}
            modifiers={[padding(0, 6, 0, 0)]}
            style={FONT_STYLES.bodyMedium}
          >
            Name a folder to organize your feeds.
          </Text>
        </Column>

        <Column
          horizontalAlignment="start"
          modifiers={[
            fillMaxWidth(),
            padding(CONTENT_HORIZONTAL_INSET, 24, CONTENT_HORIZONTAL_INSET, 0),
          ]}
        >
          <OutlinedTextField
            autoFocus={isPresented}
            colors={{
              focusedTextColor: theme.foreground,
              unfocusedTextColor: theme.foreground,
              focusedPlaceholderColor: theme.mutedForeground,
              unfocusedPlaceholderColor: theme.mutedForeground,
            }}
            enabled={!form.isCreating}
            isError={Boolean(form.nameError)}
            keyboardActions={{ onDone: () => void form.handleSubmit() }}
            keyboardOptions={{ capitalization: "words", imeAction: "done" }}
            onValueChange={form.handleNameChange}
            shape={Shape.Pill({})}
            textStyle={{ ...FONT_STYLES.input, color: theme.foreground }}
            value={name}
            modifiers={[fillMaxWidth(), height(52)]}
          >
            <OutlinedTextField.Placeholder>
              <Text style={FONT_STYLES.bodyMedium}>Folder name</Text>
            </OutlinedTextField.Placeholder>
            {form.nameError ? (
              <OutlinedTextField.SupportingText>
                <Text color={ERROR_COLOR} style={FONT_STYLES.error}>
                  {form.nameError}
                </Text>
              </OutlinedTextField.SupportingText>
            ) : null}
          </OutlinedTextField>
        </Column>

        <Column
          horizontalAlignment="start"
          modifiers={[
            fillMaxWidth(),
            padding(CONTENT_HORIZONTAL_INSET, 24, CONTENT_HORIZONTAL_INSET, 0),
          ]}
        >
          <Row horizontalArrangement={{ spacedBy: 12 }} modifiers={[fillMaxWidth()]}>
            <OutlinedButton
              enabled={!form.isCreating}
              onClick={form.handleDismiss}
              shape={Shape.Pill({})}
              modifiers={[weight(1)]}
            >
              <Box modifiers={[fillMaxWidth(), height(22)]} contentAlignment="center">
                <Text style={BUTTON_LABEL_STYLE}>Cancel</Text>
              </Box>
            </OutlinedButton>
            <Button
              colors={{ containerColor: "#a8d480", contentColor: theme.background }}
              enabled={!form.isCreating}
              onClick={() => void form.handleSubmit()}
              shape={Shape.Pill({})}
              modifiers={[weight(1)]}
            >
              <Box modifiers={[fillMaxWidth(), height(22)]} contentAlignment="center">
                {form.isCreating ? (
                  <CircularProgressIndicator
                    color={theme.background}
                    strokeWidth={2}
                    modifiers={[size(20, 20)]}
                  />
                ) : (
                  <Text style={BUTTON_LABEL_STYLE}>Create folder</Text>
                )}
              </Box>
            </Button>
          </Row>
        </Column>
      </Column>
    </BottomSheet>
  );
}
