import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Badge, Button, Eyebrow, Muted, Serif } from "@/components/ui";
import { colors, fonts, radii, spacing } from "@/constants/theme";
import { useAuth } from "@/context/auth";
import { config } from "@/lib/config";

export default function MoreScreen() {
  const insets = useSafeAreaInsets();
  const { profile, signOut } = useAuth();

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingBottom: 90 }}
    >
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Eyebrow>Console</Eyebrow>
          <Serif style={{ fontSize: 26 }}>More</Serif>
        </View>
        {profile?.role ? <Badge label={profile.role} tone="info" /> : null}
      </View>

      <Section title="Money">
        <Row icon="card-outline" label="Payments & refunds" onPress={() => router.push("/payments")} />
        <Row icon="gift-outline" label="Gift cards" onPress={() => router.push("/giftcards")} />
        <Row icon="pricetags-outline" label="Discount codes" onPress={() => router.push("/promotions")} />
        <Row icon="stats-chart-outline" label="Reports & Z-report" onPress={() => router.push("/reports")} />
      </Section>

      <Section title="Catalog">
        <Row icon="leaf-outline" label="Manage experiences" onPress={() => router.push("/experiences")} />
      </Section>

      <Section title="Guests">
        <Row icon="mail-unread-outline" label="Change requests" onPress={() => router.push("/requests")} />
        <Row icon="people-outline" label="Guest accounts" onPress={() => router.push("/users")} />
      </Section>

      <Section title="System">
        <Row icon="settings-outline" label="Booking settings" onPress={() => router.push("/settings")} />
        <Row
          icon="globe-outline"
          label="Open web console"
          onPress={() => Linking.openURL(`${config.apiUrl}/admin`)}
        />
      </Section>

      <View style={{ paddingHorizontal: spacing.md, marginTop: spacing.xl, gap: spacing.sm }}>
        <Muted style={{ fontSize: 12 }}>
          Signed in as {profile?.email ?? "—"}
        </Muted>
        <Button title="Sign Out" variant="ghost" onPress={signOut} />
      </View>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: spacing.lg }}>
      <Eyebrow style={{ paddingHorizontal: spacing.md }}>{title}</Eyebrow>
      <View style={{ paddingHorizontal: spacing.md, marginTop: spacing.sm, gap: 6 }}>{children}</View>
    </View>
  );
}

function Row({
  icon,
  label,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}>
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={17} color={colors.gold} />
      </View>
      <Text style={styles.rowLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={15} color={colors.faint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  rowIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.chip,
    alignItems: "center",
    justifyContent: "center",
  },
  rowLabel: { flex: 1, fontFamily: fonts.sansMedium, fontSize: 14, color: colors.text },
});
