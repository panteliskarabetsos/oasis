import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import {
  PlayfairDisplay_400Regular,
  PlayfairDisplay_600SemiBold,
  PlayfairDisplay_700Bold,
  useFonts,
} from "@expo-google-fonts/playfair-display";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";

import { colors, fonts } from "@/constants/theme";
import { AuthProvider } from "@/context/auth";
import { StripeProvider } from "@stripe/stripe-react-native";

import { config } from "@/lib/config";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    PlayfairDisplay_400Regular,
    PlayfairDisplay_600SemiBold,
    PlayfairDisplay_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <StripeProvider
      publishableKey={config.stripePublishableKey}
    >
      <AuthProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
          headerTitleStyle: { fontFamily: fonts.serif, fontSize: 17 },
          headerShadowVisible: false,
          headerBackButtonDisplayMode: "minimal",
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="bookings/[id]" options={{ title: "Reservation" }} />
        <Stack.Screen name="requests" options={{ title: "Guest Requests" }} />
        <Stack.Screen name="experiences" options={{ title: "Experiences" }} />
        <Stack.Screen name="experience-edit" options={{ title: "Experience" }} />
        <Stack.Screen name="payments" options={{ title: "Payments" }} />
        <Stack.Screen name="giftcards" options={{ title: "Gift Cards" }} />
        <Stack.Screen name="promotions" options={{ title: "Discount Codes" }} />
        <Stack.Screen name="reports" options={{ title: "Reports" }} />
        <Stack.Screen name="settings" options={{ title: "Settings" }} />
        <Stack.Screen name="users" options={{ title: "Guests" }} />
        <Stack.Screen name="shop-scan" options={{ headerShown: false }} />
        <Stack.Screen name="shop-products" options={{ headerShown: false }} />
        <Stack.Screen name="shop-orders" options={{ headerShown: false }} />
      </Stack>
    </AuthProvider>
    </StripeProvider>
  );
}
