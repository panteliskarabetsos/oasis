import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useEffect } from "react";
import {
  Pressable,
  StyleSheet,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { colors } from "@/constants/theme";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Pressable with a soft spring scale + optional light haptic — the app's
 *  standard "touchable" for cards and rows. */
export function PressableScale({
  style,
  onPress,
  haptic = true,
  scaleTo = 0.97,
  children,
  ...rest
}: Omit<PressableProps, "style"> & {
  style?: StyleProp<ViewStyle>;
  haptic?: boolean;
  scaleTo?: number;
}) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  return (
    <AnimatedPressable
      {...rest}
      onPressIn={() => {
        scale.value = withSpring(scaleTo, { damping: 20, stiffness: 320 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 16, stiffness: 260 });
      }}
      onPress={(e) => {
        if (haptic) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        }
        onPress?.(e);
      }}
      style={[style, animated]}
    >
      {children}
    </AnimatedPressable>
  );
}

/** Thin gold hairline with a rotated-square "diamond" — the section divider. */
export function Ornament({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[ornamentStyles.row, style]}>
      <View style={ornamentStyles.line} />
      <View style={ornamentStyles.diamond} />
      <View style={ornamentStyles.line} />
    </View>
  );
}

const ornamentStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    alignSelf: "center",
    width: 148,
  },
  line: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.gold },
  diamond: {
    width: 6,
    height: 6,
    backgroundColor: colors.gold,
    transform: [{ rotate: "45deg" }],
  },
});

/** Skeleton block with a slow moving sheen. */
export function Shimmer({ style }: { style?: StyleProp<ViewStyle> }) {
  const x = useSharedValue(-1);
  useEffect(() => {
    x.value = withRepeat(
      withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
      -1,
      false
    );
  }, [x]);
  const sheen = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value * 400 }],
  }));
  return (
    <View style={[shimmerStyles.base, style]}>
      <Animated.View style={[StyleSheet.absoluteFill, sheen]}>
        <LinearGradient
          colors={["rgba(253,250,245,0)", "rgba(253,250,245,0.75)", "rgba(253,250,245,0)"]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

const shimmerStyles = StyleSheet.create({
  base: { backgroundColor: colors.creamChip, overflow: "hidden" },
});

/** Fires a soft notification haptic — for successful moments. */
export function successHaptic() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}
