import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type PressableProps,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  type ViewProps,
  type ViewStyle,
} from "react-native";

import { PressableScale, Shimmer } from "@/components/premium";
import { colors, fonts, radii, shadows, spacing } from "@/constants/theme";

/* ---------- Typography ---------- */

export function Serif({ style, ...rest }: TextProps) {
  return <Text {...rest} style={[styles.serif, style]} />;
}

export function Body({ style, ...rest }: TextProps) {
  return <Text {...rest} style={[styles.body, style]} />;
}

export function Muted({ style, ...rest }: TextProps) {
  return <Text {...rest} style={[styles.muted, style]} />;
}

export function Eyebrow({ style, ...rest }: TextProps) {
  return <Text {...rest} style={[styles.eyebrow, style]} />;
}

/* ---------- Surfaces ---------- */

export function Card({ style, ...rest }: ViewProps) {
  return <View {...rest} style={[styles.card, style]} />;
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.divider, style]} />;
}

export function Chip({
  label,
  active,
  onPress,
  style,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive, style]}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

export function Badge({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
}) {
  const map = {
    neutral: { bg: colors.chip, fg: colors.textSoft },
    success: { bg: colors.successSoft, fg: colors.success },
    warning: { bg: colors.warningSoft, fg: colors.warning },
    danger: { bg: colors.dangerSoft, fg: colors.danger },
    info: { bg: colors.infoSoft, fg: colors.info },
  } as const;
  const t = map[tone];
  return (
    <View style={[styles.badge, { backgroundColor: t.bg }]}>
      <Text style={[styles.badgeText, { color: t.fg }]}>{label}</Text>
    </View>
  );
}

/* ---------- Buttons ---------- */

type ButtonVariant = "primary" | "ghost" | "danger" | "success";

export function Button({
  title,
  variant = "primary",
  loading,
  disabled,
  style,
  textStyle,
  ...rest
}: PressableProps & {
  title: string;
  variant?: ButtonVariant;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}) {
  const isDisabled = disabled || loading;
  return (
    <PressableScale
      accessibilityRole="button"
      disabled={isDisabled}
      scaleTo={0.96}
      {...rest}
      style={[styles.button, variantStyles[variant], isDisabled && { opacity: 0.5 }, style]}
    >
      {variant === "primary" ? (
        <LinearGradient
          colors={["#cbb086", "#b89a6b", "#9d7f52"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      {loading ? (
        <ActivityIndicator color={variant === "ghost" ? colors.gold : "#1d160f"} />
      ) : (
        <Text style={[styles.buttonText, variantTextStyles[variant], textStyle]}>{title}</Text>
      )}
    </PressableScale>
  );
}

/* ---------- Inputs ---------- */

export function Field({
  label,
  error,
  style,
  inputStyle,
  ...rest
}: TextInputProps & {
  label?: string;
  error?: string | null;
  style?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
}) {
  return (
    <View style={[{ gap: 6 }, style]}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.faint}
        keyboardAppearance="dark"
        {...rest}
        style={[styles.input, error ? { borderColor: colors.danger } : null, inputStyle]}
      />
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

/* ---------- Misc ---------- */

export function EmptyState({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  return (
    <View style={styles.empty}>
      <Serif style={{ fontSize: 21, textAlign: "center" }}>{title}</Serif>
      {subtitle ? <Muted style={{ textAlign: "center", marginTop: 8 }}>{subtitle}</Muted> : null}
      {children ? <View style={{ marginTop: spacing.lg }}>{children}</View> : null}
    </View>
  );
}

/**
 * Failure state with a way out.
 *
 * Every list in this app can fail on a flaky signal at the retreat; without a
 * retry the only recovery was leaving the screen and coming back.
 */
export function ErrorState({
  title = "Couldn't load",
  message,
  onRetry,
}: {
  title?: string;
  message?: string | null;
  onRetry?: () => void;
}) {
  return (
    <EmptyState title={title} subtitle={message ?? undefined}>
      {onRetry ? <Button title="Try again" variant="ghost" onPress={onRetry} /> : null}
    </EmptyState>
  );
}

/** Placeholder rows so a refetch does not blank the screen. */
export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <View style={{ paddingHorizontal: spacing.md, gap: spacing.sm, paddingTop: spacing.sm }}>
      {Array.from({ length: rows }).map((_, i) => (
        <Shimmer key={i} style={styles.skeletonRow} />
      ))}
    </View>
  );
}

export function StatTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone?: "success" | "warning" | "danger";
}) {
  const color =
    tone === "success"
      ? colors.success
      : tone === "warning"
        ? colors.warning
        : tone === "danger"
          ? colors.danger
          : colors.gold;
  return (
    <View style={styles.statTile}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

/* ---------- Styles ---------- */

const styles = StyleSheet.create({
  serif: { fontFamily: fonts.serif, color: colors.text, fontSize: 26, lineHeight: 32 },
  body: { fontFamily: fonts.sans, color: colors.textSoft, fontSize: 14, lineHeight: 21 },
  muted: { fontFamily: fonts.sans, color: colors.muted, fontSize: 13, lineHeight: 19 },
  eyebrow: {
    fontFamily: fonts.sansSemiBold,
    color: colors.gold,
    fontSize: 11,
    letterSpacing: 3,
    textTransform: "uppercase",
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.md,
    ...shadows.soft,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radii.pill,
    backgroundColor: colors.chip,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipText: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.textSoft },
  chipTextActive: { color: "#1d160f" },
  badge: {
    borderRadius: radii.pill,
    paddingHorizontal: 9,
    paddingVertical: 3,
    alignSelf: "flex-start",
  },
  badgeText: { fontFamily: fonts.sansSemiBold, fontSize: 11, textTransform: "capitalize" },
  button: {
    borderRadius: radii.pill,
    paddingVertical: 14,
    paddingHorizontal: 22,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
    overflow: "hidden",
  },
  buttonText: { fontFamily: fonts.sansSemiBold, fontSize: 14 },
  fieldLabel: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.textSoft },
  fieldError: { fontFamily: fonts.sans, fontSize: 12, color: colors.danger },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceHigh,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: fonts.sans,
    fontSize: 15,
    color: colors.text,
  },
  empty: { alignItems: "center", paddingVertical: 56, paddingHorizontal: 32 },
  skeletonRow: {
    height: 76,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  statTile: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 4,
  },
  statValue: { fontFamily: fonts.serif, fontSize: 24 },
  statLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 10.5,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: colors.muted,
  },
});

const variantStyles: Record<ButtonVariant, ViewStyle> = {
  primary: { backgroundColor: colors.brand },
  ghost: { backgroundColor: "transparent", borderWidth: 1, borderColor: colors.borderGold },
  danger: { backgroundColor: colors.danger },
  success: { backgroundColor: colors.success },
};

const variantTextStyles: Record<ButtonVariant, TextStyle> = {
  primary: { color: "#1d160f" },
  ghost: { color: colors.gold },
  danger: { color: colors.white },
  success: { color: "#12210e" },
};
