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
import Svg, { Defs, LinearGradient as SvgGradient, Path, Stop } from "react-native-svg";

import { PressableScale, Shimmer } from "@/components/premium";
import {
  colors,
  fonts,
  gradients,
  radii,
  shadows,
  spacing,
  toneColors,
  type Tone,
} from "@/constants/theme";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

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

export function Card({
  style,
  children,
  sheen = true,
  ...rest
}: ViewProps & { sheen?: boolean }) {
  return (
    <View {...rest} style={[styles.card, style]}>
      {/* A hairline of light along the top edge; without it large dark cards
          read as flat holes rather than raised surfaces. */}
      {sheen ? (
        <LinearGradient colors={gradients.sheen} style={styles.cardSheen} pointerEvents="none" />
      ) : null}
      {children}
    </View>
  );
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.divider, style]} />;
}

/** Rounded square holding an icon — the leading element of most rows. */
export function IconTile({
  icon,
  tone = "gold",
  size = 34,
}: {
  icon: IconName;
  tone?: Tone;
  size?: number;
}) {
  const t = toneColors(tone);
  return (
    <View
      style={[
        styles.iconTile,
        { width: size, height: size, borderRadius: size / 3, backgroundColor: t.bg },
      ]}
    >
      <Ionicons name={icon} size={Math.round(size * 0.52)} color={t.fg} />
    </View>
  );
}

/** Initials monogram, so guest lists have a fixed anchor on the left. */
export function Avatar({ name, size = 38 }: { name?: string | null; size?: number }) {
  const initials =
    (name ?? "")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase() || "—";
  return (
    <View
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <Text style={[styles.avatarText, { fontSize: size * 0.36 }]}>{initials}</Text>
    </View>
  );
}

export function Chip({
  label,
  active,
  count,
  onPress,
  style,
}: {
  label: string;
  active?: boolean;
  count?: number;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        active && styles.chipActive,
        pressed && { opacity: 0.75 },
        style,
      ]}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
      {typeof count === "number" ? (
        <Text style={[styles.chipCount, active && styles.chipTextActive]}>{count}</Text>
      ) : null}
    </Pressable>
  );
}

export function Badge({
  label,
  tone = "neutral",
  dot,
}: {
  label: string;
  tone?: Tone;
  dot?: boolean;
}) {
  const t = toneColors(tone);
  return (
    <View style={[styles.badge, { backgroundColor: t.bg }]}>
      {dot ? <View style={[styles.badgeDot, { backgroundColor: t.fg }]} /> : null}
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
  icon,
  compact,
  style,
  textStyle,
  ...rest
}: PressableProps & {
  title: string;
  variant?: ButtonVariant;
  loading?: boolean;
  icon?: IconName;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}) {
  const isDisabled = disabled || loading;
  const fg = variantTextStyles[variant].color as string;
  return (
    <PressableScale
      accessibilityRole="button"
      disabled={isDisabled}
      scaleTo={0.96}
      {...rest}
      style={[
        styles.button,
        compact && styles.buttonCompact,
        variantStyles[variant],
        isDisabled && { opacity: 0.5 },
        style,
      ]}
    >
      {variant === "primary" ? (
        <LinearGradient
          colors={gradients.gold}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      {loading ? (
        <ActivityIndicator color={variant === "ghost" ? colors.gold : colors.onGold} />
      ) : (
        <View style={styles.buttonRow}>
          {icon ? <Ionicons name={icon} size={16} color={fg} /> : null}
          <Text style={[styles.buttonText, variantTextStyles[variant], textStyle]}>{title}</Text>
        </View>
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

/** The search row every list screen had its own copy of. */
export function SearchBar({
  value,
  onChangeText,
  placeholder,
  style,
  ...rest
}: TextInputProps & { style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.search, style]}>
      <Ionicons name="search-outline" size={16} color={colors.muted} />
      <TextInput
        placeholder={placeholder}
        placeholderTextColor={colors.faint}
        value={value}
        onChangeText={onChangeText}
        returnKeyType="search"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardAppearance="dark"
        clearButtonMode="never"
        style={styles.searchInput}
        {...rest}
      />
      {value ? (
        <Pressable onPress={() => onChangeText?.("")} hitSlop={10}>
          <Ionicons name="close-circle" size={17} color={colors.muted} />
        </Pressable>
      ) : null}
    </View>
  );
}

/* ---------- Rows ---------- */

/** Icon + label + optional value, with a chevron when it navigates. */
export function ListRow({
  icon,
  tone,
  label,
  detail,
  value,
  onPress,
  chevron = true,
  style,
}: {
  icon?: IconName;
  tone?: Tone;
  label: string;
  detail?: string | null;
  value?: React.ReactNode;
  onPress?: () => void;
  chevron?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const inner = (
    <>
      {icon ? <IconTile icon={icon} tone={tone} size={32} /> : null}
      <View style={{ flex: 1, gap: 1 }}>
        <Text style={styles.rowLabel} numberOfLines={1}>
          {label}
        </Text>
        {detail ? (
          <Text style={styles.rowDetail} numberOfLines={1}>
            {detail}
          </Text>
        ) : null}
      </View>
      {typeof value === "string" ? <Text style={styles.rowValue}>{value}</Text> : value}
      {onPress && chevron ? (
        <Ionicons name="chevron-forward" size={15} color={colors.faint} />
      ) : null}
    </>
  );
  if (!onPress) return <View style={[styles.row, style]}>{inner}</View>;
  return (
    <PressableScale scaleTo={0.985} style={[styles.row, style]} onPress={onPress}>
      {inner}
    </PressableScale>
  );
}

/* ---------- Misc ---------- */

export function EmptyState({
  title,
  subtitle,
  icon,
  children,
}: {
  title: string;
  subtitle?: string;
  icon?: IconName;
  children?: React.ReactNode;
}) {
  return (
    <View style={styles.empty}>
      {icon ? (
        <View style={styles.emptyMedallion}>
          <Ionicons name={icon} size={24} color={colors.gold} />
        </View>
      ) : null}
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
    <EmptyState title={title} subtitle={message ?? undefined} icon="cloud-offline-outline">
      {onRetry ? <Button title="Try again" variant="ghost" icon="refresh" onPress={onRetry} /> : null}
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
  tone = "gold",
  icon,
  hint,
  progress,
  onPress,
}: {
  label: string;
  value: string | number;
  tone?: Tone;
  icon?: IconName;
  hint?: string;
  /** 0–1. Draws a fill bar under the value — occupancy, capacity, stock. */
  progress?: number;
  onPress?: () => void;
}) {
  const t = toneColors(tone);
  const inner = (
    <>
      <View style={styles.statHead}>
        <Text style={styles.statLabel}>{label}</Text>
        {icon ? <Ionicons name={icon} size={14} color={t.fg} /> : null}
      </View>
      <Text style={[styles.statValue, { color: t.fg }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      {typeof progress === "number" ? (
        <View style={{ marginTop: 4 }}>
          <ProgressBar value={progress} tone={tone} height={4} />
        </View>
      ) : null}
      {hint ? (
        <Text style={styles.statHint} numberOfLines={1}>
          {hint}
        </Text>
      ) : null}
    </>
  );
  if (!onPress) return <View style={styles.statTile}>{inner}</View>;
  return (
    <PressableScale style={styles.statTile} onPress={onPress}>
      {inner}
    </PressableScale>
  );
}

/** Horizontal fill bar — occupancy, stock levels, capacity. */
export function ProgressBar({
  value,
  tone = "gold",
  height = 6,
}: {
  /** 0–1. Clamped, so a 120%-booked slot still renders. */
  value: number;
  tone?: Tone;
  height?: number;
}) {
  const t = toneColors(tone);
  const pct = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  return (
    <View style={[styles.progressTrack, { height, borderRadius: height / 2 }]}>
      <View
        style={{
          width: `${pct * 100}%`,
          height: "100%",
          borderRadius: height / 2,
          backgroundColor: t.fg,
        }}
      />
    </View>
  );
}

/**
 * Filled area chart for the booking trend.
 *
 * Replaces a row of flat bars: with 30 days of data the bars were 3px wide and
 * the shape was unreadable.
 */
export function Sparkline({
  data,
  height = 56,
  tone = "gold",
}: {
  data: number[];
  height?: number;
  tone?: Tone;
}) {
  const t = toneColors(tone);
  // A fixed viewBox with preserveAspectRatio="none" lets the SVG stretch to
  // whatever width the card gives it without measuring on the JS thread.
  const W = 100;
  const H = 40;
  if (data.length < 2) return <View style={{ height }} />;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const span = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * W;
    const y = H - ((v - min) / span) * (H - 3) - 1.5;
    return [x, y] as const;
  });
  // Smooth with mid-point quadratics — cheaper than a spline solve and free of
  // the overshoot that made low days dip below the axis.
  let line = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const [px, py] = pts[i - 1];
    const [cx, cy] = pts[i];
    line += ` Q ${px} ${py} ${(px + cx) / 2} ${(py + cy) / 2}`;
  }
  line += ` L ${pts[pts.length - 1][0]} ${pts[pts.length - 1][1]}`;
  const area = `${line} L ${W} ${H} L 0 ${H} Z`;

  return (
    <Svg width="100%" height={height} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      <Defs>
        <SvgGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={t.fg} stopOpacity={0.34} />
          <Stop offset="1" stopColor={t.fg} stopOpacity={0} />
        </SvgGradient>
      </Defs>
      <Path d={area} fill="url(#sparkFill)" />
      <Path
        d={line}
        stroke={t.fg}
        strokeWidth={1.4}
        fill="none"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </Svg>
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
    letterSpacing: 2.4,
    textTransform: "uppercase",
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.md,
    overflow: "hidden",
    ...shadows.soft,
  },
  cardSheen: { position: "absolute", top: 0, left: 0, right: 0, height: 44 },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  iconTile: { alignItems: "center", justifyContent: "center" },
  avatar: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.chip,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.goldLine,
  },
  avatarText: { fontFamily: fonts.sansSemiBold, color: colors.gold, letterSpacing: 0.5 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radii.pill,
    backgroundColor: colors.chip,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipText: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.textSoft },
  chipTextActive: { color: colors.onGold },
  chipCount: { fontFamily: fonts.sansSemiBold, fontSize: 11, color: colors.muted },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: radii.pill,
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    alignSelf: "flex-start",
  },
  badgeDot: { width: 5, height: 5, borderRadius: 2.5 },
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
  buttonCompact: { paddingVertical: 9, paddingHorizontal: 16, minHeight: 38 },
  buttonRow: { flexDirection: "row", alignItems: "center", gap: 7 },
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
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radii.pill,
    paddingHorizontal: 14,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 11,
    fontFamily: fonts.sans,
    fontSize: 14.5,
    color: colors.text,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm + 2,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 13,
    paddingVertical: 11,
  },
  rowLabel: { fontFamily: fonts.sansMedium, fontSize: 14.5, color: colors.text },
  rowDetail: { fontFamily: fonts.sans, fontSize: 12, color: colors.muted },
  rowValue: { fontFamily: fonts.sansSemiBold, fontSize: 13.5, color: colors.textSoft },
  empty: { alignItems: "center", paddingVertical: 48, paddingHorizontal: 32 },
  emptyMedallion: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.goldWash,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.goldLine,
    marginBottom: spacing.md,
  },
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
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 3,
    ...shadows.soft,
  },
  statHead: { flexDirection: "row", alignItems: "center", gap: 6 },
  statValue: { fontFamily: fonts.serif, fontSize: 25, lineHeight: 31 },
  statLabel: {
    flex: 1,
    fontFamily: fonts.sansMedium,
    fontSize: 10.5,
    letterSpacing: 0.7,
    textTransform: "uppercase",
    color: colors.muted,
  },
  statHint: { fontFamily: fonts.sans, fontSize: 11.5, color: colors.faint },
  progressTrack: { backgroundColor: colors.chip, overflow: "hidden", width: "100%" },
});

const variantStyles: Record<ButtonVariant, ViewStyle> = {
  primary: { backgroundColor: colors.brand },
  ghost: { backgroundColor: "transparent", borderWidth: 1, borderColor: colors.borderGold },
  danger: { backgroundColor: colors.danger },
  success: { backgroundColor: colors.success },
};

const variantTextStyles: Record<ButtonVariant, TextStyle> = {
  primary: { color: colors.onGold },
  ghost: { color: colors.gold },
  danger: { color: colors.white },
  success: { color: "#12210e" },
};
