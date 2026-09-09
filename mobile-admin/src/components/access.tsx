import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { StyleSheet, View } from "react-native";

import { Button, EmptyState, Muted } from "@/components/ui";
import { colors, spacing } from "@/constants/theme";
import { useAuth } from "@/context/auth";
import { PERMISSION_LABELS } from "@/lib/permissions";

/**
 * Screen shown when someone reaches a section their account cannot open.
 *
 * A hidden tab is not the whole story — deep links, stale navigation state and
 * a role changed mid-session can all land staff on a screen they no longer
 * have. Without this they saw a bare "Forbidden" from the API.
 */
export function NoAccess({ permission }: { permission?: string }) {
  const { profile } = useAuth();
  const label = permission ? (PERMISSION_LABELS[permission] ?? permission) : "this section";

  return (
    <View style={styles.screen}>
      <View style={styles.icon}>
        <Ionicons name="lock-closed-outline" size={24} color={colors.gold} />
      </View>
      <EmptyState
        title="No access to this section"
        subtitle={`Your account doesn't include ${label}.`}
      >
        <View style={{ gap: spacing.sm, alignItems: "center" }}>
          <Muted style={{ fontSize: 12, textAlign: "center" }}>
            Signed in as {profile?.email ?? "—"}
            {profile?.role ? ` · ${profile.role}` : ""}
          </Muted>
          <Button title="Go back" variant="ghost" onPress={() => router.back()} />
        </View>
      </EmptyState>
    </View>
  );
}

/** Wrap a screen's content so it only renders for accounts holding `permission`. */
export function PermissionGate({
  permission,
  children,
}: {
  permission: string;
  children: React.ReactNode;
}) {
  const { can, loading } = useAuth();
  if (loading) return null;
  if (!can(permission)) return <NoAccess permission={permission} />;
  return <>{children}</>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, justifyContent: "center" },
  icon: {
    alignSelf: "center",
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.chip,
    marginBottom: spacing.sm,
  },
});
