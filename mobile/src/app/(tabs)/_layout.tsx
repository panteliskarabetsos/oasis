import { Tabs } from "expo-router";

import { OasisTabBar } from "@/components/OasisTabBar";

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <OasisTabBar {...(props as unknown as React.ComponentProps<typeof OasisTabBar>)} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="explore" options={{ title: "Explore" }} />
      <Tabs.Screen name="favorites" options={{ title: "Favorites" }} />
      <Tabs.Screen name="bookings" options={{ title: "Bookings" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}
