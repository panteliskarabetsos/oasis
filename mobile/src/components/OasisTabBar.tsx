import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, fonts } from "@/constants/theme";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

const TABS: Record<string, { label: string; icon: IconName; iconActive: IconName }> = {
  index: { label: "Home", icon: "leaf-outline", iconActive: "leaf" },
  explore: { label: "Explore", icon: "compass-outline", iconActive: "compass" },
  favorites: { label: "Saved", icon: "heart-outline", iconActive: "heart" },
  bookings: { label: "Journeys", icon: "calendar-clear-outline", iconActive: "calendar-clear" },
  profile: { label: "Profile", icon: "person-outline", iconActive: "person" },
};

// Minimal shape of @react-navigation/bottom-tabs' BottomTabBarProps (the
// package isn't hoisted for direct import; expo-router passes it through).
type TabBarProps = {
  state: {
    index: number;
    routes: { key: string; name: string; params?: object }[];
  };
  descriptors: Record<string, { options: { title?: string } } | undefined>;
  navigation: {
    emit: (e: { type: string; target?: string; canPreventDefault?: boolean }) => {
      defaultPrevented: boolean;
    };
    navigate: (name: string, params?: object) => void;
  };
};

/** Minimal-luxury tab bar: ivory ground, hairline rule, quiet monochrome
 *  icons — the active tab is marked by a single gold dot. */
export function OasisTabBar({ state, descriptors, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      {state.routes.map((route, index) => {
        const config = TABS[route.name] ?? {
          label: descriptors[route.key]?.options.title ?? route.name,
          icon: "ellipse-outline" as IconName,
          iconActive: "ellipse" as IconName,
        };
        const focused = state.index === index;

        const onPress = () => {
          const event = navigation.emit({
            type: "tabPress",
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) {
            Haptics.selectionAsync().catch(() => {});
            navigation.navigate(route.name, route.params);
          }
        };

        return (
          <Pressable
            key={route.key}
            accessibilityRole="button"
            accessibilityState={focused ? { selected: true } : {}}
            accessibilityLabel={config.label}
            onPress={onPress}
            style={styles.item}
            hitSlop={6}
          >
            <Ionicons
              name={focused ? config.iconActive : config.icon}
              size={21}
              color={focused ? "#26201a" : colors.mutedWarm}
            />
            <Text style={[styles.label, focused && styles.labelActive]}>{config.label}</Text>
            <View style={[styles.dot, focused && styles.dotActive]} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    backgroundColor: colors.creamSoft,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: 10,
  },
  item: { flex: 1, alignItems: "center", gap: 4 },
  label: {
    fontFamily: fonts.sansMedium,
    fontSize: 9,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: colors.mutedWarm,
  },
  labelActive: { color: "#26201a" },
  dot: { width: 3, height: 3, borderRadius: 2, backgroundColor: "transparent" },
  dotActive: { backgroundColor: colors.gold },
});
