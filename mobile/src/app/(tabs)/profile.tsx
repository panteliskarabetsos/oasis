import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Badge, Button, Card, Divider, Eyebrow, Muted, Serif } from "@/components/ui";
import { colors, fonts, radii, spacing } from "@/constants/theme";
import { useAuth } from "@/context/auth";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";

function memberStatus(createdAt?: string | null): string {
  if (!createdAt) return "Member";
  const days = (Date.now() - new Date(createdAt).getTime()) / 86400000;
  if (days < 30) return "Newcomer";
  if (days >= 365) return "Loyal Member";
  return "Member";
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { session, profile, loading, signOut } = useAuth();
  const [deleting, setDeleting] = useState(false);

  const firstName =
    profile?.name || (session?.user?.user_metadata?.name as string) || "Explorer";

  async function confirmDelete() {
    Alert.alert(
      "Delete account",
      "This permanently removes your account and profile. Bookings with upcoming dates must be completed or cancelled first. This cannot be undone.",
      [
        { text: "Keep my account", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setDeleting(true);
            try {
              await api.deleteAccount({
                userId: profile?.id ?? undefined,
                email: profile?.email ?? undefined,
              });
              await signOut();
              Alert.alert("Account deleted", "We're sorry to see you go. Be well.");
            } catch (e) {
              Alert.alert(
                "Could not delete account",
                e instanceof Error ? e.message : "Please try again later."
              );
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingBottom: 48 }}
    >
      <View style={styles.header}>
        <View style={styles.avatarRing}>
          <View style={styles.avatar}>
            {session ? (
              <Text style={styles.avatarText}>
                {(firstName[0] ?? "O").toUpperCase()}
                {(profile?.surname?.[0] ?? "").toUpperCase()}
              </Text>
            ) : (
              <Ionicons name="leaf" size={26} color={colors.brand} />
            )}
          </View>
        </View>
        <View style={{ flex: 1 }}>
          <Eyebrow>{session ? greeting() : "Welcome"}</Eyebrow>
          <Serif style={{ fontSize: 28, marginTop: 2 }}>
            {session ? firstName : "Your Oasis"}
          </Serif>
          {session && profile?.role ? (
            <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
              <Badge
                label={profile.role === "user" ? "Explorer" : profile.role}
                tone="neutral"
              />
              <Badge label={memberStatus(profile.createdAt)} tone="success" />
            </View>
          ) : null}
        </View>
      </View>

      {!loading && !session ? (
        <View style={{ paddingHorizontal: spacing.md, gap: spacing.sm }}>
          <Card>
            <Serif style={{ fontSize: 19 }}>Join the journey</Serif>
            <Muted style={{ marginTop: 4 }}>
              Log in to manage bookings, save favorites, and breeze through checkout.
            </Muted>
            <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.md }}>
              <Button title="Log In" onPress={() => router.push("/login")} style={{ flex: 1 }} />
              <Button
                title="Register"
                variant="ghost"
                onPress={() => router.push("/sign-up")}
                style={{ flex: 1 }}
              />
            </View>
          </Card>
        </View>
      ) : null}

      {session && profile ? (
        <View style={{ paddingHorizontal: spacing.md }}>
          <Card>
            <Serif style={{ fontSize: 18 }}>Personal details</Serif>
            <InfoRow label="Name" value={[profile.name, profile.surname].filter(Boolean).join(" ") || "—"} />
            <InfoRow label="Email" value={profile.email ?? "—"} />
            <InfoRow label="Phone" value={profile.phone || "—"} />
            <InfoRow label="Date of birth" value={profile.dateOfBirth ? formatDate(profile.dateOfBirth) : "—"} />
            <InfoRow label="Member since" value={profile.createdAt ? formatDate(profile.createdAt) : "—"} />
            <Button
              title="Edit details"
              variant="ghost"
              onPress={() => router.push("/account-settings")}
              style={{ marginTop: spacing.sm }}
            />
          </Card>
        </View>
      ) : null}

      {/* Quick actions */}
      <View style={styles.section}>
        <Eyebrow>Your Space</Eyebrow>
        <MenuRow icon="calendar-outline" label="My Bookings" onPress={() => router.push("/bookings")} />
        <MenuRow icon="heart-outline" label="My Favorites" onPress={() => router.push("/favorites")} />
        <MenuRow
          icon="key-outline"
          label="Guest Portal (find a booking)"
          onPress={() => router.push("/manage-booking")}
        />
        {session ? (
          <MenuRow
            icon="settings-outline"
            label="Account Settings"
            onPress={() => router.push("/account-settings")}
          />
        ) : null}
      </View>

      <View style={styles.section}>
        <Eyebrow>Discover Oasis</Eyebrow>
        <MenuRow icon="book-outline" label="Our Story" onPress={() => router.push("/about")} />
        <MenuRow icon="flower-outline" label="Retreats" onPress={() => router.push("/retreats")} />
        <MenuRow icon="wine-outline" label="Private Gatherings" onPress={() => router.push("/private")} />
        <MenuRow icon="chatbubble-ellipses-outline" label="Contact Us" onPress={() => router.push("/contact")} />
      </View>

      <View style={styles.section}>
        <Eyebrow>Legal</Eyebrow>
        <MenuRow icon="shield-checkmark-outline" label="Privacy Policy" onPress={() => router.push("/privacy-policy")} />
        <MenuRow icon="document-text-outline" label="Terms of Use" onPress={() => router.push("/terms-of-use")} />
        <MenuRow icon="close-circle-outline" label="Cancellation Policy" onPress={() => router.push("/cancellation-policy")} />
      </View>

      {session ? (
        <View style={[styles.section, { gap: spacing.sm }]}>
          <Button
            title="Sign Out"
            variant="ghost"
            onPress={async () => {
              await signOut();
            }}
          />
          <Divider />
          <Muted style={{ fontSize: 12 }}>
            Danger zone — deleting your account removes your profile permanently.
          </Muted>
          <Button
            title="Delete Account"
            variant="danger"
            loading={deleting}
            onPress={confirmDelete}
          />
        </View>
      ) : null}

      <Muted style={{ textAlign: "center", marginTop: spacing.xl, fontSize: 12 }}>
        Oasis — Agrotourism & Wellness · Chania, Crete
      </Muted>
    </ScrollView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function MenuRow({
  icon,
  label,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.menuRow, pressed && { opacity: 0.7 }]}
    >
      <View style={styles.menuIcon}>
        <Ionicons name={icon} size={18} color={colors.brand} />
      </View>
      <Text style={styles.menuLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={16} color={colors.mutedWarm} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  avatarRing: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 1.5,
    borderColor: colors.gold,
    alignItems: "center",
    justifyContent: "center",
  },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.sand,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontFamily: fonts.serif,
    fontSize: 22,
    color: colors.brownDeeper,
    letterSpacing: 1,
  },
  section: { paddingHorizontal: spacing.md, marginTop: spacing.lg, gap: spacing.xs },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md,
    marginTop: 10,
  },
  infoLabel: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.mutedWarm },
  infoValue: { flex: 1, textAlign: "right", fontFamily: fonts.sansMedium, fontSize: 13, color: colors.brownDeep },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.creamSoft,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    marginTop: 6,
  },
  menuIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.creamChip,
    alignItems: "center",
    justifyContent: "center",
  },
  menuLabel: { flex: 1, fontFamily: fonts.sansMedium, fontSize: 14, color: colors.brownDeep },
});
