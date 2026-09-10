import { router } from "expo-router";
import { View } from "react-native";

import { Screen } from "@/components/screen";
import { Button, EmptyState, Muted } from "@/components/ui";
import { spacing } from "@/constants/theme";
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
    <Screen style={{ justifyContent: "center" }}>
      <EmptyState
        title="No access to this section"
        subtitle={`Your account doesn't include ${label}.`}
        icon="lock-closed-outline"
      >
        <View style={{ gap: spacing.sm, alignItems: "center" }}>
          <Muted style={{ fontSize: 12, textAlign: "center" }}>
            Signed in as {profile?.email ?? "—"}
            {profile?.role ? ` · ${profile.role}` : ""}
          </Muted>
          <Button title="Go back" variant="ghost" icon="arrow-back" onPress={() => router.back()} />
        </View>
      </EmptyState>
    </Screen>
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
