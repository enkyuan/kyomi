import { Host } from "@expo/ui";
import {
  BottomSheet,
  Button,
  HStack,
  ProgressView,
  Text,
  TextField,
  useNativeState,
  VStack,
  ZStack,
} from "@expo/ui/swift-ui";
import {
  accessibilityHint,
  accessibilityLabel,
  background,
  buttonBorderShape,
  buttonStyle,
  clipShape,
  controlSize,
  disabled,
  font,
  foregroundStyle,
  frame,
  onSubmit,
  padding,
  strokeBorder,
  submitLabel,
  textFieldStyle,
  textInputAutocapitalization,
  tint,
} from "@expo/ui/swift-ui/modifiers";
import { useColorScheme } from "react-native";
import { FONT_FAMILIES, FONT_SIZES, SWIFT_FONT_WEIGHTS } from "@/theme/fonts";
import { getMobileSurfaceTheme } from "@/theme/surfaces";
import { useCreateFolder } from "../hooks/use-create-folder";
import type { CreateFolderProps } from "../lib/create-folder.types";

const ERROR_COLOR = "#c0392b";
const FULL_WIDTH = [frame({ maxWidth: Infinity })];
const LEADING_FULL_WIDTH = [frame({ maxWidth: Infinity, alignment: "leading" })];
const CENTERED_LABEL = [frame({ maxWidth: Infinity, alignment: "center" })];
const ROW_PADDING = [padding({ horizontal: 24 })];

/** SwiftUI expression of the folder-name sheet. */
export function CreateFolder({ isPresented, onDismiss }: CreateFolderProps) {
  const theme = getMobileSurfaceTheme(useColorScheme());
  const name = useNativeState("");
  const form = useCreateFolder({ isPresented, name, onDismiss });

  return (
    // Raw swift-ui views need a Host bridge; unlike the email sheet (hosted by
    // its parent screen) this sheet mounts straight into the RN tabs tree, so
    // it hosts itself. matchContents keeps the Host from taking layout space.
    <Host matchContents>
      <BottomSheet
        fitToContents
        isPresented={isPresented}
        onIsPresentedChange={(open) => !open && form.handleDismiss()}
      >
        <VStack alignment="leading" spacing={20} modifiers={[...FULL_WIDTH, padding({ top: 28 })]}>
          <VStack
            alignment="leading"
            spacing={6}
            modifiers={[...LEADING_FULL_WIDTH, ...ROW_PADDING]}
          >
            <Text
              modifiers={[
                font({
                  family: FONT_FAMILIES.inter.bold,
                  size: FONT_SIZES.screenTitle,
                  weight: SWIFT_FONT_WEIGHTS.bold,
                }),
                foregroundStyle(theme.foreground),
              ]}
            >
              Create folder
            </Text>
            <Text
              modifiers={[
                font({ family: FONT_FAMILIES.inter.regular, size: FONT_SIZES.bodyMedium }),
                foregroundStyle(theme.mutedForeground),
              ]}
            >
              Name a folder to organize your feeds.
            </Text>
          </VStack>

          <VStack alignment="leading" spacing={8} modifiers={[...FULL_WIDTH, ...ROW_PADDING]}>
            <TextField
              autoFocus={isPresented}
              onTextChange={form.handleNameChange}
              placeholder="e.g., Personal"
              text={name}
              modifiers={[
                textFieldStyle("plain"),
                textInputAutocapitalization("words"),
                font({ family: FONT_FAMILIES.inter.regular, size: FONT_SIZES.input }),
                foregroundStyle(theme.foreground),
                padding({ horizontal: 20 }),
                frame({ height: 52 }),
                ...FULL_WIDTH,
                background(theme.input),
                clipShape("capsule"),
                strokeBorder({
                  color: form.nameError ? ERROR_COLOR : "clear",
                  style: { lineWidth: 2 },
                  shape: "capsule",
                }),
                accessibilityLabel("Folder name"),
                accessibilityHint(form.nameError ?? "Enter a name for this folder."),
                disabled(form.isCreating),
                onSubmit(() => void form.handleSubmit()),
                submitLabel("done"),
              ]}
            />
            {form.nameError ? (
              <Text
                modifiers={[
                  font({
                    family: FONT_FAMILIES.inter.regular,
                    size: FONT_SIZES.bodySmall,
                  }),
                  foregroundStyle(ERROR_COLOR),
                  accessibilityLabel(form.nameError),
                ]}
              >
                {form.nameError}
              </Text>
            ) : null}
          </VStack>

          <HStack spacing={12} modifiers={[...FULL_WIDTH, ...ROW_PADDING]}>
            <Button
              onPress={form.handleDismiss}
              role="cancel"
              modifiers={[
                buttonStyle("bordered"),
                buttonBorderShape("capsule"),
                controlSize("large"),
                disabled(form.isCreating),
                accessibilityLabel("Cancel folder creation"),
                ...FULL_WIDTH,
              ]}
            >
              {/* Expanding centered label so this button matches the primary
                  button's width — a plain `label` prop would hug its text and
                  break the 50/50 split. */}
              <Text
                modifiers={[
                  ...CENTERED_LABEL,
                  font({
                    family: FONT_FAMILIES.inter.semibold,
                    size: FONT_SIZES.button,
                    weight: SWIFT_FONT_WEIGHTS.semibold,
                  }),
                  foregroundStyle(theme.foreground),
                ]}
              >
                Cancel
              </Text>
            </Button>
            <Button
              onPress={() => void form.handleSubmit()}
              modifiers={[
                buttonStyle("glassProminent"),
                buttonBorderShape("capsule"),
                controlSize("large"),
                tint("#a8d480"),
                disabled(form.isCreating),
                accessibilityLabel(form.isCreating ? "Creating folder" : "Create folder"),
                ...FULL_WIDTH,
              ]}
            >
              <ZStack modifiers={[...FULL_WIDTH, frame({ height: 22 })]}>
                {form.isCreating ? (
                  <ProgressView
                    modifiers={[
                      tint(theme.background),
                      controlSize("regular"),
                      frame({ width: 20, height: 20 }),
                    ]}
                  />
                ) : (
                  <Text
                    modifiers={[
                      ...CENTERED_LABEL,
                      font({
                        family: FONT_FAMILIES.inter.semibold,
                        size: FONT_SIZES.button,
                        weight: SWIFT_FONT_WEIGHTS.semibold,
                      }),
                      foregroundStyle(theme.background),
                    ]}
                  >
                    Create folder
                  </Text>
                )}
              </ZStack>
            </Button>
          </HStack>
        </VStack>
      </BottomSheet>
    </Host>
  );
}
