import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Badge, Button, Eyebrow, Muted, Serif } from "@/components/ui";
import { colors, fonts, radii, spacing } from "@/constants/theme";
import { useAuth } from "@/context/auth";
import { PERMISSION_LABELS } from "@/lib/permissions";
import { config } from "@/lib/config";

export default function MoreScreen() {
  const insets = useSafeAreaInsets();
  const { profile, signOut, can, access } = useAuth();

  // Only offer what this account can actually open — every row below maps to
  // an API guarded by the same permission, so an ungated row is just a 403.
  const sections = [
    {
      title: "Money",
      rows: [
        { perm: "pos", icon: "calculator-outline", label: "Point of sale", href: "/pos" },
        { perm: "payments", icon: "card-outline", label: "Payments & refunds", href: "/payments" },
        { perm: "giftcards", icon: "gift-outline", label: "Gift cards", href: "/giftcards" },
        { perm: "promotions", icon: "pricetags-outline", label: "Discount codes", href: "/promotions" },
        { perm: "zreport", icon: "stats-chart-outline", label: "Reports & Z-report", href: "/reports" },
      ],
    },
    {
      title: "Catalog",
      rows: [
        { perm: "experiences", icon: "leaf-outline", label: "Manage experiences", href: "/experiences" },
      ],
    },
    {
      title: "Guests",
      rows: [
        { perm: "requests", icon: "mail-unread-outline", label: "Change requests", href: "/requests" },
        { perm: "guests", icon: "people-outline", label: "Guest accounts", href: "/users" },
      ],
    },
    {
      title: "System",
      rows: [
        { perm: "planner", icon: "settings-outline", label: "Booking settings", href: "/settings" },
      ],
    },
  ]
    .map((section) => ({ ...section, rows: section.rows.filter((r) => can(r.perm)) }))
    .filter((section) => section.rows.length > 0);

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

      {sections.map((section) => (
        <Section key={section.title} title={section.title}>
          {section.rows.map((row) => (
            <Row
              key={row.href}
              icon={row.icon as React.ComponentProps<typeof Ionicons>["name"]}
              label={row.label}
              onPress={() => router.push(row.href as never)}
            />
          ))}
        </Section>
      ))}

      <Section title="System">
        <Row
          icon="globe-outline"
          label="Open web console"
          onPress={() => Linking.openURL(`${config.apiUrl}/admin`)}
        />
      </Section>

      <Section title="Your access">
        <View style={styles.accessCard}>
          <View style={styles.accessHead}>
            <Ionicons name="shield-checkmark-outline" size={16} color={colors.gold} />
            <Text style={styles.accessRole}>
              {access === "*" ? "Full access" : `${access.length} component${access.length === 1 ? "" : "s"}`}
            </Text>
            {profile?.role ? <Badge label={profile.role} tone="info" /> : null}
          </View>
          <Text style={styles.accessBody}>
            {access === "*"
              ? "This account can open every section of the console."
              : access.length
                ? access.map((p) => PERMISSION_LABELS[p] ?? p).sort().join(" · ")
                : "No components granted yet."}
          </Text>
        </View>
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
  accessCard: {
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    gap: 8,
  },
  accessHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  accessRole: { flex: 1, fontFamily: fonts.sansMedium, fontSize: 14, color: colors.text },
  accessBody: { fontFamily: fonts.sans, fontSize: 12.5, lineHeight: 19, color: colors.muted },
  rowLabel: { flex: 1, fontFamily: fonts.sansMedium, fontSize: 14, color: colors.text },
});
