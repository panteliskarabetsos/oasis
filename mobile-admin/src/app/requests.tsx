import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Badge, Button, Card, Chip, EmptyState, Muted } from "@/components/ui";
import { colors, fonts, spacing } from "@/constants/theme";
import { useApi } from "@/hooks/useApi";
import { api } from "@/lib/api";
import type { BookingRequest } from "@/lib/types";
import { PermissionGate } from "@/components/access";

function RequestsScreenContent() {
  const { data, loading, error, refresh } = useApi(() => api.requests());
  const [busyId, setBusyId] = useState<number | null>(null);

  async function resolve(
    r: BookingRequest,
    action: "approve" | "reject",
    refundOption?: "full" | "partial"
  ) {
    setBusyId(r.id);
    try {
      await api.resolveRequest(r.id, { action, refundOption });
      refresh();
    } catch (e) {
      Alert.alert("Requests", e instanceof Error ? e.message : "Failed.");
    } finally {
      setBusyId(null);
    }
  }

  function confirmApprove(r: BookingRequest) {
    if (r.type === "cancel") {
      Alert.alert("Approve cancellation", "Choose the refund to issue with the approval.", [
        { text: "Back", style: "cancel" },
        { text: "No refund", onPress: () => resolve(r, "approve") },
        { text: "Partial (50%)", onPress: () => resolve(r, "approve", "partial") },
        { text: "Full refund", style: "destructive", onPress: () => resolve(r, "approve", "full") },
      ]);
    } else {
      Alert.alert("Approve request", "Apply this change to the booking?", [
        { text: "Back", style: "cancel" },
        { text: "Approve", onPress: () => resolve(r, "approve") },
      ]);
    }
  }

  const items = data ?? [];

  if (loading) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator color={colors.gold} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ padding: spacing.md, gap: spacing.md, paddingBottom: 48 }}
      refreshControl={<RefreshControl refreshing={false} onRefresh={refresh} tintColor={colors.gold} />}
    >
      {error ? (
        <EmptyState title="Couldn't load requests" subtitle={error} />
      ) : items.length === 0 ? (
        <EmptyState title="Inbox zero" subtitle="No pending guest requests." />
      ) : (
        items.map((r) => (
          <Card key={r.id}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Badge
                label={r.type === "cancel" ? "cancellation" : r.type ?? "request"}
                tone={r.type === "cancel" ? "danger" : "info"}
              />
              <Muted style={{ fontSize: 11 }}>
                {r.created_at ? new Date(r.created_at).toLocaleString("en-GB") : ""}
              </Muted>
            </View>
            <Text style={styles.guest}>
              {r.guestName ?? r.booking?.primary_contact?.name ?? "Guest"}
              {"  "}
              <Text style={styles.ref}>{r.reference ?? (r.booking_id ? `#${r.booking_id}` : "")}</Text>
            </Text>
            {r.experienceName ? <Muted style={{ fontSize: 13 }}>{r.experienceName}</Muted> : null}
            {r.reason ? (
              <View style={styles.reason}>
                <Ionicons name="chatbubble-ellipses-outline" size={13} color={colors.muted} />
                <Muted style={{ flex: 1, fontSize: 13 }}>{r.reason}</Muted>
              </View>
            ) : null}
            {busyId === r.id ? (
              <ActivityIndicator color={colors.gold} style={{ marginTop: spacing.md }} />
            ) : (
              <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.md }}>
                <Button
                  title="Approve"
                  variant="success"
                  onPress={() => confirmApprove(r)}
                  style={{ flex: 1, minHeight: 42, paddingVertical: 10 }}
                />
                <Button
                  title="Reject"
                  variant="ghost"
                  onPress={() =>
                    Alert.alert("Reject request", "The guest will keep their current booking.", [
                      { text: "Back", style: "cancel" },
                      { text: "Reject", style: "destructive", onPress: () => resolve(r, "reject") },
                    ])
                  }
                  style={{ flex: 1, minHeight: 42, paddingVertical: 10 }}
                />
              </View>
            )}
          </Card>
        ))
      )}
      <View style={{ marginTop: spacing.sm }}>
        <Chip label="Refresh" onPress={refresh} style={{ alignSelf: "center" }} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { justifyContent: "center", alignItems: "center" },
  guest: { fontFamily: fonts.sansBold, fontSize: 15, color: colors.text, marginTop: 8 },
  ref: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.gold },
  reason: { flexDirection: "row", gap: 6, marginTop: 8, alignItems: "flex-start" },
});

export default function RequestsScreen() {
  return (
    <PermissionGate permission="requests">
      <RequestsScreenContent />
    </PermissionGate>
  );
}
