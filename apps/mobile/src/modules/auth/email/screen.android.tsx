import CloseSymbol from "@expo/material-symbols/close.xml";
import MailSymbol from "@expo/material-symbols/mail.xml";
import { BottomSheet } from "@expo/ui";
import {
  AlertDialog,
  AnimatedVisibility,
  BasicTextField,
  Box,
  Button,
  CircularProgressIndicator,
  Column,
  EnterTransition,
  ExitTransition,
  Icon,
  IconButton,
  OutlinedTextField,
  Row,
  Shape,
  Text,
  type TextFieldRef,
  useNativeState,
} from "@expo/ui/jetpack-compose";
import {
  align,
  background,
  border,
  clickable,
  clip,
  fillMaxWidth,
  height,
  padding,
  paddingAll,
  semantics,
  Shapes,
  size,
  tween,
  weight,
} from "@expo/ui/jetpack-compose/modifiers";
import { useCallback, useRef } from "react";
import { mobileColors } from "@/theme/colors";
import { OTP_LENGTH, OTP_SLOTS } from "./constants";
import { useEmailAuth } from "./hooks/use-email-auth";
import { FONT_STYLES } from "@/theme/fonts";

const BUTTON_LABEL_STYLE = FONT_STYLES.button;
const STEP_ENTER_TRANSITION = EnterTransition.fadeIn()
  .plus(EnterTransition.scaleIn({ initialScale: 0.96 }))
  .plus(EnterTransition.expandVertically());
const STEP_EXIT_TRANSITION = ExitTransition.fadeOut()
  .plus(ExitTransition.scaleOut({ targetScale: 0.96 }))
  .plus(ExitTransition.shrinkVertically());
const REDUCED_MOTION_STEP_ENTER_TRANSITION = EnterTransition.fadeIn();
const REDUCED_MOTION_STEP_EXIT_TRANSITION = ExitTransition.fadeOut();

type Theme = { background: string; foreground: string; input: string };

export type EmailSheetProps = {
  isPresented: boolean;
  onDismiss: () => void;
  theme: Theme;
};

export function EmailSheet({ isPresented, onDismiss, theme }: EmailSheetProps) {
  const email = useNativeState("");
  const otp = useNativeState("");
  const emailFieldRef = useRef<TextFieldRef>(null);
  const otpFieldRef = useRef<TextFieldRef>(null);
  const focusEmail = useCallback(() => emailFieldRef.current?.focus(), []);
  const focusOtp = useCallback(() => otpFieldRef.current?.focus(), []);
  const {
    errorMessage,
    handleDismiss,
    handleEmailChange,
    handleErrorAlertChange,
    handleOtpChange,
    handleSendCode,
    handleUseDifferentEmail,
    handleVerifyCode,
    isEmailInvalid,
    isEmailStep,
    isOtpInvalid,
    isSubmitting,
    otpValue,
    shouldReduceMotion,
    showErrorAlert,
  } = useEmailAuth({ email, focusEmail, focusOtp, isPresented, onDismiss, otp });

  const stepEnterTransition = shouldReduceMotion
    ? REDUCED_MOTION_STEP_ENTER_TRANSITION
    : STEP_ENTER_TRANSITION;
  const stepExitTransition = shouldReduceMotion
    ? REDUCED_MOTION_STEP_EXIT_TRANSITION
    : STEP_EXIT_TRANSITION;

  return (
    <>
      {showErrorAlert ? (
        <AlertDialog
          onDismissRequest={() => handleErrorAlertChange(false)}
          colors={{
            titleContentColor: theme.foreground,
            textContentColor: theme.foreground,
          }}
        >
          <AlertDialog.Title>
            <Text color={theme.foreground} style={FONT_STYLES.button}>
              Email sign-in error
            </Text>
          </AlertDialog.Title>
          <AlertDialog.Text>
            <Text color={theme.foreground} style={FONT_STYLES.bodyMedium}>
              {errorMessage ?? "Please try again."}
            </Text>
          </AlertDialog.Text>
          <AlertDialog.ConfirmButton>
            <Button
              onClick={() => handleErrorAlertChange(false)}
              colors={{ containerColor: "transparent", contentColor: mobileColors.matcha }}
            >
              <Text color={mobileColors.matcha} style={FONT_STYLES.button}>
                OK
              </Text>
            </Button>
          </AlertDialog.ConfirmButton>
        </AlertDialog>
      ) : null}
      <BottomSheet isPresented={isPresented} onDismiss={handleDismiss}>
        <Column modifiers={[fillMaxWidth()]}>
          <Box modifiers={[fillMaxWidth(), paddingAll(16)]} contentAlignment="topEnd">
            <IconButton onClick={handleDismiss}>
              <Icon
                contentDescription="Close"
                source={CloseSymbol}
                size={28}
                tint={theme.foreground}
              />
            </IconButton>
          </Box>

          <Column horizontalAlignment="start" modifiers={[fillMaxWidth(), padding(24, 0, 24, 24)]}>
            <Box
              contentAlignment="center"
              modifiers={[size(64, 64), background(theme.input), clip(Shapes.Circle)]}
            >
              <Icon source={MailSymbol} size={24} tint={theme.foreground} />
            </Box>

            <Box modifiers={[fillMaxWidth()]}>
              <AnimatedVisibility
                visible={isEmailStep}
                enterTransition={stepEnterTransition}
                exitTransition={stepExitTransition}
              >
                <Column horizontalAlignment="start" modifiers={[fillMaxWidth()]}>
                  <Text
                    color={theme.foreground}
                    modifiers={[padding(0, 20, 0, 0)]}
                    style={FONT_STYLES.screenTitle}
                  >
                    Continue with Email
                  </Text>

                  <Text
                    color={theme.foreground}
                    modifiers={[padding(0, 6, 0, 0)]}
                    style={FONT_STYLES.bodyMedium}
                  >
                    Sign in or sign up to get started
                  </Text>

                  <OutlinedTextField
                    ref={emailFieldRef}
                    value={email}
                    isError={isEmailInvalid}
                    onValueChange={handleEmailChange}
                    modifiers={[fillMaxWidth(), padding(0, 24, 0, 0), height(52)]}
                    keyboardOptions={{
                      keyboardType: "email",
                      capitalization: "none",
                      autoCorrectEnabled: false,
                    }}
                  >
                    <OutlinedTextField.Placeholder>
                      <Text style={FONT_STYLES.bodyMedium}>you@example.com</Text>
                    </OutlinedTextField.Placeholder>
                  </OutlinedTextField>
                </Column>
              </AnimatedVisibility>

              <AnimatedVisibility
                visible={!isEmailStep}
                enterTransition={stepEnterTransition}
                exitTransition={stepExitTransition}
              >
                <Column horizontalAlignment="start" modifiers={[fillMaxWidth()]}>
                  <Text
                    color={theme.foreground}
                    modifiers={[padding(0, 20, 0, 0)]}
                    style={FONT_STYLES.screenTitle}
                  >
                    Enter your code
                  </Text>

                  <Text
                    color={theme.foreground}
                    modifiers={[padding(0, 2, 0, 0)]}
                    style={FONT_STYLES.body}
                  >
                    {`We sent a code to ${email.value}.`}
                  </Text>

                  <Box modifiers={[fillMaxWidth(), padding(0, 24, 0, 0)]}>
                    <Row horizontalArrangement={{ spacedBy: 10 }} modifiers={[fillMaxWidth()]}>
                      {OTP_SLOTS.map((slot) => (
                        <Box
                          key={slot}
                          contentAlignment="center"
                          modifiers={[
                            weight(1),
                            height(52),
                            background(theme.input),
                            clip(Shapes.RoundedCorner(14)),
                            border(
                              2,
                              isOtpInvalid
                                ? mobileColors.validationError
                                : otpValue.length === slot
                                  ? mobileColors.matcha
                                  : "transparent",
                            ),
                            clickable(focusOtp),
                          ]}
                        >
                          <Text style={FONT_STYLES.otp} color={theme.foreground}>
                            {otpValue[slot] ?? ""}
                          </Text>
                        </Box>
                      ))}
                    </Row>
                    <BasicTextField
                      ref={otpFieldRef}
                      value={otp}
                      onValueChange={handleOtpChange}
                      keyboardOptions={{
                        keyboardType: "number",
                        capitalization: "none",
                        autoCorrectEnabled: false,
                      }}
                      modifiers={[size(0, 0), semantics({ contentType: "one-time-code" })]}
                    />
                  </Box>

                  <Button
                    onClick={handleUseDifferentEmail}
                    colors={{ containerColor: "transparent", contentColor: theme.foreground }}
                    contentPadding={{ top: 12, bottom: 12 }}
                    modifiers={[fillMaxWidth(), padding(0, 12, 0, 0)]}
                  >
                    <Box modifiers={[fillMaxWidth()]}>
                      <Text style={FONT_STYLES.bodyMediumMedium} modifiers={[align("center")]}>
                        Use a different email
                      </Text>
                    </Box>
                  </Button>
                </Column>
              </AnimatedVisibility>
            </Box>

            <Button
              onClick={
                isEmailStep
                  ? handleSendCode
                  : otpValue.length === OTP_LENGTH
                    ? () => handleVerifyCode(otpValue)
                    : handleSendCode
              }
              shape={Shape.Pill({})}
              colors={{ containerColor: mobileColors.matcha, contentColor: theme.background }}
              contentPadding={{ top: 14, bottom: 14 }}
              modifiers={[fillMaxWidth(), padding(0, 24, 0, 0)]}
            >
              <Box modifiers={[fillMaxWidth(), height(22)]} contentAlignment="center">
                {isSubmitting ? (
                  <CircularProgressIndicator
                    color={theme.background}
                    strokeWidth={2}
                    modifiers={[size(20, 20)]}
                  />
                ) : (
                  <Text style={BUTTON_LABEL_STYLE} modifiers={[align("center")]}>
                    {isEmailStep || otpValue.length === OTP_LENGTH ? "Continue" : "Resend email"}
                  </Text>
                )}
              </Box>
            </Button>
          </Column>
        </Column>
      </BottomSheet>
    </>
  );
}
