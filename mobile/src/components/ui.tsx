import { Ionicons } from "@expo/vector-icons";
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

import { PressableScale } from "@/components/premium";
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

/** Uppercase letterspaced eyebrow, like the web's section overlines. */
export function Eyebrow({
  style,
  light,
  ...rest
}: TextProps & { light?: boolean }) {
  return (
    <Text
      {...rest}
      style={[styles.eyebrow, light && { color: colors.sandSoft }, style]}
    />
  );
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
      <Text style={[styles.chipText, active && styles.chipTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

/* ---------- Buttons ---------- */

type ButtonVariant = "primary" | "sand" | "ghost" | "danger";

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
      style={[
        styles.button,
        variantStyles[variant],
        isDisabled && { opacity: 0.5 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === "sand" || variant === "ghost" ? colors.brownDeep : colors.white}
        />
      ) : (
        <Text style={[styles.buttonText, variantTextStyles[variant], textStyle]}>
          {title}
        </Text>
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
  labelStyle,
  ...rest
}: TextInputProps & {
  label?: string;
  error?: string | null;
  style?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
  labelStyle?: StyleProp<TextStyle>;
}) {
  return (
    <View style={[{ gap: 6 }, style]}>
      {label ? <Text style={[styles.fieldLabel, labelStyle]}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.mutedWarm}
        {...rest}
        style={[styles.input, error ? { borderColor: colors.danger } : null, inputStyle]}
      />
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

/* ---------- Misc ---------- */

export function Badge({ label, tone = "neutral" }: { label: string; tone?: "neutral" | "success" | "warning" | "danger" }) {
  const map = {
    neutral: { bg: colors.creamChip, fg: colors.brownDeep },
    success: { bg: colors.successSoft, fg: colors.success },
    warning: { bg: colors.warningSoft, fg: colors.warning },
    danger: { bg: colors.dangerSoft, fg: colors.danger },
  } as const;
  const t = map[tone];
  return (
    <View style={[styles.badge, { backgroundColor: t.bg }]}>
      <Text style={[styles.badgeText, { color: t.fg }]}>{label}</Text>
    </View>
  );
}

export function EmptyState({
  title,
  subtitle,
  icon,
  children,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ComponentProps<typeof Ionicons>["name"];
  children?: React.ReactNode;
}) {
  return (
    <View style={styles.empty}>
      {icon ? (
        <View style={styles.emptyMedallion}>
          <Ionicons name={icon} size={22} color={colors.brand} />
        </View>
      ) : null}
      <Serif style={{ fontSize: 22, textAlign: "center" }}>{title}</Serif>
      {subtitle ? (
        <Muted style={{ textAlign: "center", marginTop: 8 }}>{subtitle}</Muted>
      ) : null}
      {children ? <View style={{ marginTop: spacing.lg }}>{children}</View> : null}
    </View>
  );
}

/* ---------- Styles ---------- */

const styles = StyleSheet.create({
  emptyMedallion: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.creamChip,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSand,
    marginBottom: spacing.md,
  },
  serif: {
    fontFamily: fonts.serifRegular,
    color: "#26201a",
    fontSize: 28,
    lineHeight: 36,
  },
  body: {
    fontFamily: fonts.sans,
    color: colors.ink,
    fontSize: 15,
    lineHeight: 23,
  },
  muted: {
    fontFamily: fonts.sans,
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
  },
  eyebrow: {
    fontFamily: fonts.sansMedium,
    color: colors.gold,
    fontSize: 10,
    letterSpacing: 3.2,
    textTransform: "uppercase",
  },
  card: {
    backgroundColor: colors.creamSoft,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.md,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.creamChip,
    borderWidth: 1,
    borderColor: colors.borderWarm,
  },
  chipActive: {
    backgroundColor: colors.brownDeep,
    borderColor: colors.brownDeep,
  },
  chipText: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    color: colors.brownDeep,
  },
  chipTextActive: { color: colors.creamSoft },
  button: {
    borderRadius: radii.sm,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 50,
    overflow: "hidden",
  },
  buttonText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 12.5,
    letterSpacing: 2.2,
    textTransform: "uppercase",
  },
  fieldLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    color: colors.brownDeep,
  },
  fieldError: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.danger,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    borderRadius: radii.md,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontFamily: fonts.sans,
    fontSize: 15,
    color: colors.ink,
  },
  badge: {
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: "flex-start",
  },
  badgeText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 11,
    textTransform: "capitalize",
  },
  empty: {
    alignItems: "center",
    paddingVertical: 64,
    paddingHorizontal: 32,
  },
});

const variantStyles: Record<ButtonVariant, ViewStyle> = {
  primary: { backgroundColor: "#26201a" }, // espresso slab
  sand: { backgroundColor: colors.sand },
  ghost: {
    backgroundColor: "transparent",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.brownDeep,
  },
  danger: { backgroundColor: colors.danger },
};

const variantTextStyles: Record<ButtonVariant, TextStyle> = {
  primary: { color: colors.creamSoft },
  sand: { color: "#26201a" },
  ghost: { color: colors.brownDeep },
  danger: { color: colors.white },
};
