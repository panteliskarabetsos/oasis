import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { Redirect, Tabs } from "expo-router";
import { ActivityIndicator, StyleSheet, View, type ColorValue } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button, EmptyState, Muted } from "@/components/ui";
import { TAB_BAR_HEIGHT, colors, fonts, radii, shadows, spacing } from "@/constants/theme";
import { useAuth } from "@/context/auth";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

/** Outline when resting, solid when selected — the iOS convention, and the
 *  clearest "you are here" signal on a bar this dark. */
function tabIcon(outline: IconName, solid: IconName) {
  return function TabIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
    return <Ionicons name={focused ? solid : outline} size={23} color={color} />;
  };
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const { session, profile, loading, signOut, can } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: "center" }}>
        <ActivityIndicator color={colors.gold} />
      </View>
    );
  }
  if (!session) return <Redirect href="/login" />;
  // A staff member with no components granted has nothing to open.
  if (profile && !can()) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: "center" }}>
        <EmptyState
          title="Staff access only"
          icon="lock-closed-outline"
          subtitle={
            profile?.role && profile.role !== "user"
              ? `The ${profile.role} role has no components assigned yet. Ask a Super Admin to grant access.`
              : "This account isn't a staff account."
          }
        >
          <View style={{ gap: spacing.sm, alignItems: "center" }}>
            <Muted style={{ fontSize: 12 }}>Signed in as {profile?.email ?? "—"}</Muted>
            <Button title="Sign Out" variant="ghost" onPress={signOut} />
          </View>
        </EmptyState>
      </View>
    );
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.gold,
        tabBarInactiveTintColor: colors.muted,
        // The bar floats over the content rather than sitting in its own
        // opaque strip; screens reserve room for it with `useTabBarPadding`.
        tabBarStyle: {
          position: "absolute",
          left: spacing.md,
          right: spacing.md,
          bottom: Math.max(insets.bottom, spacing.sm),
          height: TAB_BAR_HEIGHT,
          paddingBottom: 0,
          paddingTop: 6,
          borderRadius: radii.xl,
          borderTopWidth: 0,
          backgroundColor: "transparent",
          ...shadows.lifted,
        },
        tabBarItemStyle: { paddingVertical: 0 },
        tabBarLabelStyle: {
          fontFamily: fonts.sansMedium,
          fontSize: 9.5,
          letterSpacing: 0.2,
          marginTop: 1,
        },
        tabBarBackground: () => (
          <View style={styles.barBackground}>
            <BlurView tint="dark" intensity={42} style={StyleSheet.absoluteFill} />
            {/* Blur alone over an espresso background reads grey; the wash
                pulls it back toward the brand brown. */}
            <View style={styles.barTint} />
          </View>
        ),
      }}
      screenListeners={{
        tabPress: () => {
          Haptics.selectionAsync().catch(() => {});
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Home", tabBarIcon: tabIcon("grid-outline", "grid") }}
      />
      <Tabs.Screen
        name="bookings"
        options={{
          title: "Bookings",
          href: can("bookings") ? undefined : null,
          tabBarIcon: tabIcon("calendar-outline", "calendar"),
        }}
      />
      <Tabs.Screen
        name="checkins"
        options={{
          title: "Check-in",
          href: can("checkins") ? undefined : null,
          tabBarIcon: tabIcon("qr-code-outline", "qr-code"),
        }}
      />
      <Tabs.Screen
        name="manifest"
        options={{
          title: "Manifest",
          href: can("schedule") ? undefined : null,
          tabBarIcon: tabIcon("list-outline", "list"),
        }}
      />
      <Tabs.Screen
        name="schedule"
        options={{
          title: "Availability",
          // Editing availability is a different privilege from reading the day.
          href: can("experiences") ? undefined : null,
          tabBarIcon: tabIcon("time-outline", "time"),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: "More",
          tabBarIcon: tabIcon("ellipsis-horizontal-circle-outline", "ellipsis-horizontal-circle"),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  barBackground: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: radii.xl,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderGold,
  },
  barTint: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(33,26,19,0.62)",
  },
});
