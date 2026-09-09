import { Ionicons } from "@expo/vector-icons";
import { Redirect, Tabs } from "expo-router";
import { ActivityIndicator, View } from "react-native";

import { Button, EmptyState, Muted } from "@/components/ui";
import { colors, fonts, spacing } from "@/constants/theme";
import { useAuth } from "@/context/auth";

export default function TabsLayout() {
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
        tabBarInactiveTintColor: colors.faint,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
        tabBarLabelStyle: { fontFamily: fonts.sansMedium, fontSize: 10 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="grid-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="bookings"
        options={{
          title: "Bookings",
          href: can("bookings") ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="checkins"
        options={{
          title: "Check-in",
          href: can("checkins") ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="qr-code-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="manifest"
        options={{
          title: "Manifest",
          href: can("schedule") ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="list-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="schedule"
        options={{
          title: "Availability",
          // Editing availability is a different privilege from reading the day.
          href: can("experiences") ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="time-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: "More",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="ellipsis-horizontal-circle-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
