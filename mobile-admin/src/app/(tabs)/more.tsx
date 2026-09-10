import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Linking, ScrollView, StyleSheet, Text, View } from "react-native";

import { Screen, ScreenHeader, SectionHeader, useTabBarPadding } from "@/components/screen";
import { Badge, Button, Card, ListRow, Muted } from "@/components/ui";
import { colors, fonts, spacing } from "@/constants/theme";
import { useAuth } from "@/context/auth";
import { PERMISSION_LABELS } from "@/lib/permissions";
import { config } from "@/lib/config";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

type Row = { perm?: string; icon: IconName; label: string; detail: string; href?: string; url?: string };

// Only offer what this account can actually open — every row below maps to an
// API guarded by the same permission, so an ungated row is just a 403.
const SECTIONS: { title: string; rows: Row[] }[] = [
  {
    title: "Money",
    rows: [
      {
        perm: "pos",
        icon: "calculator-outline",
        label: "Point of sale",
        detail: "Ring up walk-ins and take card payments",
        href: "/pos",
      },
      {
        perm: "payments",
        icon: "card-outline",
        label: "Payments & refunds",
        detail: "Charges, payment links, refunds",
        href: "/payments",
      },
      {
        perm: "giftcards",
        icon: "gift-outline",
        label: "Gift cards",
        detail: "Issue and redeem balances",
        href: "/giftcards",
      },
      {
        perm: "promotions",
        icon: "pricetags-outline",
        label: "Discount codes",
        detail: "Create and retire promo codes",
        href: "/promotions",
      },
      {
        perm: "zreport",
        icon: "stats-chart-outline",
        label: "Reports & Z-report",
        detail: "Daily takings and breakdowns",
        href: "/reports",
      },
    ],
  },
  {
    title: "Catalog",
    rows: [
      {
        perm: "experiences",
        icon: "leaf-outline",
        label: "Manage experiences",
        detail: "Pricing, capacity, photos",
        href: "/experiences",
      },
    ],
  },
  {
    title: "Shop",
    rows: [
      {
        perm: "eshop",
        icon: "barcode-outline",
        label: "Scan a product",
        detail: "Look up stock by barcode",
        href: "/shop-scan",
      },
      {
        perm: "eshop",
        icon: "cube-outline",
        label: "Products & stock",
        detail: "Inventory, sizes, shipping weights",
        href: "/shop-products",
      },
      {
        perm: "eshop",
        icon: "receipt-outline",
        label: "Shop orders",
        detail: "Fulfilment, tracking, refunds",
        href: "/shop-orders",
      },
    ],
  },
  {
    title: "Guests",
    rows: [
      {
        perm: "requests",
        icon: "mail-unread-outline",
        label: "Change requests",
        detail: "Reschedules and cancellations to review",
        href: "/requests",
      },
      {
        perm: "guests",
        icon: "people-outline",
        label: "Guest accounts",
        detail: "Search guests and their bookings",
        href: "/users",
      },
    ],
  },
  {
    title: "System",
    rows: [
      {
        perm: "planner",
        icon: "settings-outline",
        label: "Booking settings",
        detail: "Lead times, cut-offs, meetup points",
        href: "/settings",
      },
      // No permission — the web console enforces its own access.
      {
        icon: "globe-outline",
        label: "Open web console",
        detail: config.apiUrl.replace(/^https?:\/\//, ""),
        url: `${config.apiUrl}/admin`,
      },
    ],
  },
];

export default function MoreScreen() {
  const bottomPad = useTabBarPadding(spacing.lg);
  const { profile, signOut, can, access } = useAuth();

  const sections = SECTIONS.map((section) => ({
    ...section,
    rows: section.rows.filter((r) => !r.perm || can(r.perm)),
  })).filter((section) => section.rows.length > 0);

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ paddingBottom: bottomPad }}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader
          eyebrow="Console"
          title="More"
          trailing={profile?.role ? <Badge label={profile.role} tone="info" dot /> : undefined}
        />

        {sections.map((section) => (
          <View key={section.title}>
            <SectionHeader title={section.title} />
            <View style={styles.group}>
              {section.rows.map((row) => (
                <ListRow
                  key={row.href ?? row.url}
                  icon={row.icon}
                  label={row.label}
                  detail={row.detail}
                  onPress={() =>
                    row.url ? Linking.openURL(row.url) : router.push(row.href as never)
                  }
                />
              ))}
            </View>
          </View>
        ))}

        <SectionHeader title="Your access" />
        <Card style={{ marginHorizontal: spacing.md, gap: 9 }}>
          <View style={styles.accessHead}>
            <Ionicons name="shield-checkmark-outline" size={16} color={colors.gold} />
            <Text style={styles.accessRole}>
              {access === "*"
                ? "Full access"
                : `${access.length} component${access.length === 1 ? "" : "s"}`}
            </Text>
            {profile?.role ? <Badge label={profile.role} tone="info" /> : null}
          </View>
          <Text style={styles.accessBody}>
            {access === "*"
              ? "This account can open every section of the console."
              : access.length
                ? access
                    .map((p) => PERMISSION_LABELS[p] ?? p)
                    .sort()
                    .join(" · ")
                : "No components granted yet."}
          </Text>
        </Card>

        <View style={styles.footer}>
          <Muted style={{ fontSize: 12 }}>Signed in as {profile?.email ?? "—"}</Muted>
          <Button title="Sign Out" variant="ghost" icon="log-out-outline" onPress={signOut} />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  group: { paddingHorizontal: spacing.md, gap: 6 },
  accessHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  accessRole: { flex: 1, fontFamily: fonts.sansMedium, fontSize: 14, color: colors.text },
  accessBody: { fontFamily: fonts.sans, fontSize: 12.5, lineHeight: 19, color: colors.muted },
  footer: {
    paddingHorizontal: spacing.md,
    marginTop: spacing.xl,
    gap: spacing.sm,
    alignItems: "stretch",
  },
});
