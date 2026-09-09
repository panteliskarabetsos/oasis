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
import { StripeProvider } from "@stripe/stripe-react-native";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";

import { colors, fonts } from "@/constants/theme";
import { AuthProvider } from "@/context/auth";
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
      publishableKey={config.stripePublishableKey || "pk_test_placeholder"}
      merchantIdentifier="merchant.gr.youroasis.app"
    >
    <AuthProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.cream },
          headerTintColor: colors.brownDeep,
          headerTitleStyle: { fontFamily: fonts.serif, fontSize: 18 },
          headerShadowVisible: false,
          headerBackButtonDisplayMode: "minimal",
          contentStyle: { backgroundColor: colors.cream },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="experience/[slug]" options={{ headerShown: false }} />
        <Stack.Screen name="book/[slug]" options={{ title: "Check Availability" }} />
        <Stack.Screen name="draft/[id]/attendees" options={{ title: "Guest Details" }} />
        <Stack.Screen name="draft/[id]/payment" options={{ title: "Payment" }} />
        <Stack.Screen
          name="draft/[id]/confirmation"
          options={{ title: "Confirmation", headerBackVisible: false, gestureEnabled: false }}
        />
        <Stack.Screen name="bookings/[id]" options={{ title: "Your Booking" }} />
        <Stack.Screen name="manage-booking" options={{ title: "Guest Portal" }} />
        <Stack.Screen name="login" options={{ title: "Log In", presentation: "modal" }} />
        <Stack.Screen name="sign-up" options={{ title: "Register" }} />
        <Stack.Screen name="forgot-password" options={{ title: "Forgot Password" }} />
        <Stack.Screen name="reset-password" options={{ title: "Reset Password" }} />
        <Stack.Screen name="account-settings" options={{ title: "Account Settings" }} />
        <Stack.Screen name="contact" options={{ title: "Contact" }} />
        <Stack.Screen name="about" options={{ title: "Our Story" }} />
        <Stack.Screen name="retreats" options={{ title: "Retreats" }} />
        <Stack.Screen name="private" options={{ title: "Private Gatherings" }} />
        <Stack.Screen name="private-inquire" options={{ title: "Private Inquiry" }} />
        <Stack.Screen name="privacy-policy" options={{ title: "Privacy Policy" }} />
        <Stack.Screen name="terms-of-use" options={{ title: "Terms of Use" }} />
        <Stack.Screen
          name="cancellation-policy"
          options={{ title: "Cancellation Policy" }}
        />
      </Stack>
    </AuthProvider>
    </StripeProvider>
  );
}
