import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Badge, Button, Card, Chip, EmptyState, Field, Muted, Serif, StatTile } from "@/components/ui";
import { colors, fonts, radii, spacing } from "@/constants/theme";
import { useApi } from "@/hooks/useApi";
import { api } from "@/lib/api";
import type { GiftCard } from "@/lib/types";

function cents(n?: number): string {
  return `€${((n ?? 0) / 100).toFixed(2)}`;
}

function randomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "GIFT-";
  for (let i = 0; i < 8; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export default function GiftcardsScreen() {
  const { data: cards, loading, error, refresh } = useApi(() => api.giftcards());
  const { data: metrics, refresh: refreshMetrics } = useApi(() => api.giftcardMetrics());
  const [createOpen, setCreateOpen] = useState(false);
  const [code, setCode] = useState(randomCode());
  const [amount, setAmount] = useState("50");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<GiftCard | null>(null);
  const [redeemAmount, setRedeemAmount] = useState("");

  async function create() {
    const cents_ = Math.round(Number(amount) * 100);
    if (!code.trim() || !cents_ || cents_ <= 0) {
      Alert.alert("Gift card", "Add a code and a valid amount.");
      return;
    }
    setBusy(true);
    try {
      await api.createGiftcard({
        code: code.trim().toUpperCase(),
        initialAmountCents: cents_,
        currency: "EUR",
        recipientEmail: email.trim() || undefined,
        recipientName: name.trim() || undefined,
      });
      setCreateOpen(false);
      setCode(randomCode());
      refresh();
      refreshMetrics();
    } catch (e) {
      Alert.alert("Gift card", e instanceof Error ? e.message : "Could not create.");
    } finally {
      setBusy(false);
    }
  }

  async function redeem() {
    if (!selected) return;
    const cents_ = Math.round(Number(redeemAmount) * 100);
    if (!cents_ || cents_ <= 0) return Alert.alert("Redeem", "Enter a valid amount.");
    setBusy(true);
    try {
      await api.redeemGiftcard(selected.id, { amountCents: cents_, notes: "Redeemed via mobile admin" });
      setSelected(null);
      refresh();
      refreshMetrics();
    } catch (e) {
      Alert.alert("Redeem", e instanceof Error ? e.message : "Failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.md, gap: spacing.sm, paddingBottom: 90 }}
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={() => { refresh(); refreshMetrics(); }} tintColor={colors.gold} />
        }
      >
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <StatTile label="Outstanding" value={cents(metrics?.outstandingCents)} />
          <StatTile label="Sold (30d)" value={metrics?.sold30d ?? 0} tone="success" />
        </View>

        <Button title="+ New gift card" onPress={() => setCreateOpen(true)} style={{ marginTop: spacing.sm }} />

        {loading ? (
          <ActivityIndicator color={colors.gold} style={{ marginTop: spacing.xl }} />
        ) : error ? (
          <EmptyState title="Couldn't load gift cards" subtitle={error} />
        ) : (cards ?? []).length === 0 ? (
          <EmptyState title="No gift cards yet" />
        ) : (
          (cards ?? []).map((c) => (
            <Pressable
              key={String(c.id)}
              onPress={() => {
                setSelected(c);
                setRedeemAmount(String(((c.remainingAmountCents ?? 0) / 100).toFixed(2)));
              }}
            >
              <Card>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.code}>{c.code}</Text>
                    <Muted style={{ fontSize: 11 }}>
                      {c.recipientName || c.recipientEmail || "No recipient"} ·{" "}
                      {c.issuedAt ? new Date(c.issuedAt).toLocaleDateString("en-GB") : ""}
                    </Muted>
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 5 }}>
                    <Text style={styles.amount}>
                      {cents(c.remainingAmountCents)}{" "}
                      <Muted style={{ fontSize: 11 }}>/ {cents(c.initialAmountCents)}</Muted>
                    </Text>
                    <Badge
                      label={c.status ?? "active"}
                      tone={c.status === "void" ? "danger" : c.status === "redeemed" ? "neutral" : "success"}
                    />
                  </View>
                </View>
              </Card>
            </Pressable>
          ))
        )}
      </ScrollView>

      {/* Create modal */}
      <Modal visible={createOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setCreateOpen(false)}>
        <ScrollView style={styles.modal} contentContainerStyle={{ padding: spacing.md, paddingBottom: 48 }}>
          <View style={styles.modalHeader}>
            <Serif style={{ fontSize: 21 }}>New gift card</Serif>
            <Pressable onPress={() => setCreateOpen(false)} hitSlop={8}>
              <Ionicons name="close" size={22} color={colors.text} />
            </Pressable>
          </View>
          <Field label="Code" autoCapitalize="characters" value={code} onChangeText={setCode} />
          <View style={{ flexDirection: "row", gap: 8, marginTop: spacing.sm }}>
            {["25", "50", "100", "150"].map((a) => (
              <Chip key={a} label={`€${a}`} active={amount === a} onPress={() => setAmount(a)} />
            ))}
          </View>
          <Field
            label="Amount (€)"
            keyboardType="decimal-pad"
            value={amount}
            onChangeText={setAmount}
            style={{ marginTop: spacing.sm }}
          />
          <Field
            label="Recipient email (optional — sends the card)"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            style={{ marginTop: spacing.sm }}
          />
          <Field
            label="Recipient name (optional)"
            value={name}
            onChangeText={setName}
            style={{ marginTop: spacing.sm }}
          />
          <Button title="Create gift card" loading={busy} onPress={create} style={{ marginTop: spacing.lg }} />
          <Muted style={{ marginTop: spacing.sm, fontSize: 12 }}>
            Created as an offline card (already paid). Card payments for gift cards are handled on the web console.
          </Muted>
        </ScrollView>
      </Modal>

      {/* Card actions modal */}
      <Modal visible={!!selected} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        <Pressable style={styles.backdrop} onPress={() => setSelected(null)} />
        {selected ? (
          <View style={styles.sheet}>
            <View style={styles.modalHeader}>
              <Serif style={{ fontSize: 20 }}>{selected.code}</Serif>
              <Pressable onPress={() => setSelected(null)} hitSlop={8}>
                <Ionicons name="close" size={22} color={colors.text} />
              </Pressable>
            </View>
            <Muted style={{ fontSize: 12 }}>
              Balance {cents(selected.remainingAmountCents)} of {cents(selected.initialAmountCents)}
            </Muted>
            {selected.status !== "void" && (selected.remainingAmountCents ?? 0) > 0 ? (
              <>
                <Field
                  label="Redeem amount (€)"
                  keyboardType="decimal-pad"
                  value={redeemAmount}
                  onChangeText={setRedeemAmount}
                  style={{ marginTop: spacing.md }}
                />
                <Button title="Redeem in person" loading={busy} onPress={redeem} style={{ marginTop: spacing.md }} />
              </>
            ) : null}
            {selected.recipientEmail ? (
              <Button
                title="Resend email"
                variant="ghost"
                onPress={async () => {
                  try {
                    await api.resendGiftcard(selected.id);
                    Alert.alert("Sent", "Gift card email re-sent.");
                  } catch (e) {
                    Alert.alert("Resend", e instanceof Error ? e.message : "Failed.");
                  }
                }}
                style={{ marginTop: spacing.sm }}
              />
            ) : null}
            {selected.status !== "void" ? (
              <Button
                title="Void card"
                variant="danger"
                onPress={() =>
                  Alert.alert("Void gift card", "This permanently disables the card.", [
                    { text: "Back", style: "cancel" },
                    {
                      text: "Void",
                      style: "destructive",
                      onPress: async () => {
                        try {
                          await api.voidGiftcard(selected.id);
                          setSelected(null);
                          refresh();
                        } catch (e) {
                          Alert.alert("Void", e instanceof Error ? e.message : "Failed.");
                        }
                      },
                    },
                  ])
                }
                style={{ marginTop: spacing.sm }}
              />
            ) : null}
          </View>
        ) : (
          <View />
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  code: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.gold, letterSpacing: 0.5 },
  amount: { fontFamily: fonts.serif, fontSize: 16, color: colors.text },
  modal: { flex: 1, backgroundColor: colors.bg },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)" },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    borderTopWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    paddingBottom: spacing.xl + 8,
  },
});
