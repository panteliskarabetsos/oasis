import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PressableScale } from "@/components/premium";
import { Eyebrow, Serif } from "@/components/ui";
import { TAB_BAR_HEIGHT, colors, fonts, gradients, spacing } from "@/constants/theme";

/**
 * Every tab screen used to hand-roll its own chrome: the same background, the
 * same `insets.top + spacing.md`, the same eyebrow-over-serif title, and a
 * `paddingBottom: 90` guess for the tab bar. They drifted apart by a few points
 * each. `Screen` and `ScreenHeader` are the single source for all of it.
 */

/** Bottom padding that clears the floating tab bar plus the home indicator. */
export function useTabBarPadding(extra: number = spacing.md): number {
  const insets = useSafeAreaInsets();
  return TAB_BAR_HEIGHT + Math.max(insets.bottom, spacing.sm) + extra;
}

export function Screen({
  children,
  style,
  /** Warm light bleeding down from the top. Off for full-bleed screens
   *  (the scanner) where it would tint the camera feed. */
  ambient = true,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  ambient?: boolean;
}) {
  return (
    <View style={[styles.screen, style]}>
      {ambient ? (
        <LinearGradient
          colors={gradients.ambient}
          style={styles.ambient}
          pointerEvents="none"
        />
      ) : null}
      {children}
    </View>
  );
}

export function ScreenHeader({
  eyebrow,
  title,
  subtitle,
  trailing,
  /** Draws a back control. Screens that hide the native header (the shop and
   *  till screens) otherwise leave the swipe gesture as the only way out. */
  onBack,
  /** Set on screens whose content scrolls under the header (the header is
   *  inside the scroll view, so it must not add the safe-area inset twice). */
  inline = false,
  style,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string | null;
  trailing?: React.ReactNode;
  onBack?: () => void;
  inline?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const insets = useSafeAreaInsets();
  const topPad = inline ? 0 : insets.top + spacing.sm;
  return (
    <View style={style}>
      {/* The back control gets its own row: inline, it indented the eyebrow
          past the chevron and the title block stopped reading as one unit. */}
      {onBack ? (
        <View style={[styles.backRow, { paddingTop: topPad }]}>
          <PressableScale style={styles.back} onPress={onBack} accessibilityLabel="Go back">
            <Ionicons name="chevron-back" size={19} color={colors.textSoft} />
          </PressableScale>
        </View>
      ) : null}
      <View style={[styles.header, { paddingTop: onBack ? spacing.sm : topPad }]}>
        <View style={{ flex: 1, gap: 2 }}>
          {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
          <Serif style={styles.title}>{title}</Serif>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
      </View>
    </View>
  );
}

/** Section label with an optional right-hand action, e.g. "See all". */
export function SectionHeader({
  title,
  action,
  style,
}: {
  title: string;
  action?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.section, style]}>
      <Eyebrow style={{ flex: 1 }}>{title}</Eyebrow>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  ambient: { position: "absolute", top: 0, left: 0, right: 0, height: 320 },
  header: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xs,
    gap: spacing.sm + 2,
  },
  title: { fontSize: 27, lineHeight: 34 },
  subtitle: {
    fontFamily: fonts.sans,
    fontSize: 13,
    lineHeight: 19,
    color: colors.muted,
    marginTop: 2,
  },
  trailing: { alignItems: "flex-end", justifyContent: "flex-end", paddingBottom: 4 },
  backRow: { paddingHorizontal: spacing.md },
  back: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    alignSelf: "flex-start",
  },
  section: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
});
