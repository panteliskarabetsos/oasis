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
  Switch,
  Text,
  View,
} from "react-native";

import { Badge, Button, Card, Chip, EmptyState, Field, Muted, Serif } from "@/components/ui";
import { colors, fonts, radii, spacing } from "@/constants/theme";
import { useApi } from "@/hooks/useApi";
import { api } from "@/lib/api";

type Tab = "codes" | "campaigns" | "vouchers";

function windowLabel(startsAt?: string | null, endsAt?: string | null): string {
  const fmt = (s: string) => new Date(s).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" });
  if (startsAt && endsAt) return `${fmt(startsAt)} – ${fmt(endsAt)}`;
  if (endsAt) return `until ${fmt(endsAt)}`;
  if (startsAt) return `from ${fmt(startsAt)}`;
  return "always on";
}

export default function PromotionsScreen() {
  const [tab, setTab] = useState<Tab>("codes");
  const codesQ = useApi(() => api.discountCodes());
  const campaignsQ = useApi(() => api.campaigns());
  const vouchersQ = useApi(() => api.vouchers());

  const [createOpen, setCreateOpen] = useState(false);
  const [code, setCode] = useState("");
  const [type, setType] = useState<"percent" | "amount">("percent");
  const [value, setValue] = useState("10");
  const [maxRedemptions, setMaxRedemptions] = useState("");
  const [campName, setCampName] = useState("");
  const [campDesc, setCampDesc] = useState("");
  const [busy, setBusy] = useState(false);

  function refreshAll() {
    codesQ.refresh();
    campaignsQ.refresh();
    vouchersQ.refresh();
  }

  async function toggleCode(id: number | string, active: boolean) {
    try {
      await api.updateDiscountCode(id, { active });
      codesQ.refresh();
    } catch (e) {
      Alert.alert("Discount code", e instanceof Error ? e.message : "Failed.");
    }
  }

  async function toggleCampaign(id: number | string, active: boolean) {
    try {
      await api.updateCampaign(id, { active });
      campaignsQ.refresh();
    } catch (e) {
      Alert.alert("Campaign", e instanceof Error ? e.message : "Failed.");
    }
  }

  async function toggleVoucher(id: number | string, active: boolean) {
    try {
      await api.updateVoucher(id, { active });
      vouchersQ.refresh();
    } catch (e) {
      Alert.alert("Voucher", e instanceof Error ? e.message : "Failed.");
    }
  }

  async function create() {
    setBusy(true);
    try {
      if (tab === "campaigns") {
        if (!campName.trim()) throw new Error("Add a campaign name.");
        await api.createCampaign({
          name: campName.trim(),
          description: campDesc.trim() || undefined,
          scope: "global",
          active: true,
        });
        campaignsQ.refresh();
      } else {
        if (!code.trim() || !Number(value)) throw new Error("Add a code and value.");
        await api.createDiscountCode({
          code: code.trim().toUpperCase(),
          discountType: type,
          discountValue: Number(value),
          currency: "EUR",
          maxRedemptions: maxRedemptions ? Number(maxRedemptions) : undefined,
          scope: "global",
          active: true,
        });
        codesQ.refresh();
      }
      setCreateOpen(false);
      setCode("");
      setCampName("");
      setCampDesc("");
    } catch (e) {
      Alert.alert("Promotions", e instanceof Error ? e.message : "Could not create.");
    } finally {
      setBusy(false);
    }
  }

  const loading =
    (tab === "codes" && codesQ.loading) ||
    (tab === "campaigns" && campaignsQ.loading) ||
    (tab === "vouchers" && vouchersQ.loading);
  const error =
    tab === "codes" ? codesQ.error : tab === "campaigns" ? campaignsQ.error : vouchersQ.error;

  return (
    <View style={styles.screen}>
      {/* Tabs */}
      <View style={styles.tabs}>
        {(
          [
            ["codes", `Codes${codesQ.data ? ` (${codesQ.data.length})` : ""}`],
            ["campaigns", `Campaigns${campaignsQ.data ? ` (${campaignsQ.data.length})` : ""}`],
            ["vouchers", `Vouchers${vouchersQ.data ? ` (${vouchersQ.data.length})` : ""}`],
          ] as [Tab, string][]
        ).map(([t, label]) => (
          <Pressable
            key={t}
            onPress={() => setTab(t)}
            style={[styles.tab, tab === t && styles.tabActive]}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing.md, gap: spacing.sm, paddingBottom: 64 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={refreshAll} tintColor={colors.gold} />}
      >
        {tab !== "vouchers" ? (
          <Button
            title={tab === "codes" ? "+ New discount code" : "+ New campaign"}
            onPress={() => setCreateOpen(true)}
          />
        ) : (
          <Muted style={{ fontSize: 12, paddingHorizontal: 4 }}>
            Vouchers are single-guest codes issued from the web console; you can pause or resume them here.
          </Muted>
        )}

        {loading ? (
          <ActivityIndicator color={colors.gold} style={{ marginTop: spacing.xl }} />
        ) : error ? (
          <EmptyState title="Couldn't load" subtitle={error} />
        ) : tab === "codes" ? (
          (codesQ.data ?? []).length === 0 ? (
            <EmptyState title="No discount codes" subtitle="Create one to run a promotion." />
          ) : (
            (codesQ.data ?? []).map((c) => {
              const exhausted =
                c.maxRedemptions != null && (c.redemptionCount ?? 0) >= c.maxRedemptions;
              const expired = c.endsAt ? new Date(c.endsAt).getTime() < Date.now() : false;
              return (
                <Card key={String(c.id)}>
                  <View style={styles.rowTop}>
                    <Text style={styles.code}>{c.code}</Text>
                    <View style={styles.valuePill}>
                      <Text style={styles.valuePillText}>
                        {c.discountType === "percent" ? `${c.discountValue}%` : `€${c.discountValue}`} off
                      </Text>
                    </View>
                    <View style={{ flex: 1 }} />
                    <Switch
                      value={Boolean(c.active)}
                      onValueChange={(v) => toggleCode(c.id, v)}
                      trackColor={{ true: colors.brand }}
                    />
                  </View>
                  <View style={styles.metaRow}>
                    <Ionicons name="repeat-outline" size={12} color={colors.muted} />
                    <Muted style={{ fontSize: 12 }}>
                      {c.redemptionCount ?? 0}
                      {c.maxRedemptions ? ` / ${c.maxRedemptions}` : ""} used
                    </Muted>
                    <Ionicons name="time-outline" size={12} color={colors.muted} style={{ marginLeft: 8 }} />
                    <Muted style={{ fontSize: 12 }}>{windowLabel(c.startsAt, c.endsAt)}</Muted>
                  </View>
                  <View style={{ flexDirection: "row", gap: 6, marginTop: 8 }}>
                    {!c.active ? <Badge label="paused" tone="neutral" /> : expired ? (
                      <Badge label="expired" tone="danger" />
                    ) : exhausted ? (
                      <Badge label="exhausted" tone="warning" />
                    ) : (
                      <Badge label="live" tone="success" />
                    )}
                    {(c as any).minSpend ? (
                      <Badge label={`min €${(c as any).minSpend}`} tone="neutral" />
                    ) : null}
                  </View>
                </Card>
              );
            })
          )
        ) : tab === "campaigns" ? (
          (campaignsQ.data ?? []).length === 0 ? (
            <EmptyState title="No campaigns" subtitle="Campaigns show as the site's promo banner." />
          ) : (
            (campaignsQ.data ?? []).map((c) => {
              const expired = c.endsAt ? new Date(c.endsAt).getTime() < Date.now() : false;
              return (
                <Card key={String(c.id)}>
                  <View style={styles.rowTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.campName} numberOfLines={2}>
                        {c.name}
                      </Text>
                      {c.description ? (
                        <Muted style={{ fontSize: 12, marginTop: 2 }} numberOfLines={2}>
                          {c.description}
                        </Muted>
                      ) : null}
                    </View>
                    <Switch
                      value={Boolean(c.active)}
                      onValueChange={(v) => toggleCampaign(c.id, v)}
                      trackColor={{ true: colors.brand }}
                    />
                  </View>
                  <View style={styles.metaRow}>
                    <Ionicons name="time-outline" size={12} color={colors.muted} />
                    <Muted style={{ fontSize: 12 }}>{windowLabel(c.startsAt, c.endsAt)}</Muted>
                    <View style={{ flex: 1 }} />
                    <Badge
                      label={!c.active ? "off" : expired ? "ended" : "live on site"}
                      tone={!c.active ? "neutral" : expired ? "danger" : "success"}
                    />
                  </View>
                </Card>
              );
            })
          )
        ) : (vouchersQ.data ?? []).length === 0 ? (
          <EmptyState title="No vouchers" />
        ) : (
          (vouchersQ.data ?? []).map((v) => (
            <Card key={String(v.id)}>
              <View style={styles.rowTop}>
                <Text style={styles.code}>{v.code}</Text>
                <View style={styles.valuePill}>
                  <Text style={styles.valuePillText}>
                    {v.discountType === "percent" ? `${v.discountValue}%` : `€${v.discountValue}`}
                  </Text>
                </View>
                <View style={{ flex: 1 }} />
                <Switch
                  value={Boolean(v.active)}
                  onValueChange={(val) => toggleVoucher(v.id, val)}
                  trackColor={{ true: colors.brand }}
                />
              </View>
              <View style={styles.metaRow}>
                <Ionicons name="person-outline" size={12} color={colors.muted} />
                <Muted style={{ fontSize: 12 }}>{v.assignedToEmail || "Unassigned"}</Muted>
                <Ionicons name="repeat-outline" size={12} color={colors.muted} style={{ marginLeft: 8 }} />
                <Muted style={{ fontSize: 12 }}>
                  {v.redemptionCount ?? 0}
                  {v.maxRedemptions ? ` / ${v.maxRedemptions}` : ""} used
                </Muted>
              </View>
            </Card>
          ))
        )}
      </ScrollView>

      {/* Create modal */}
      <Modal
        visible={createOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setCreateOpen(false)}
      >
        <ScrollView style={styles.modal} contentContainerStyle={{ padding: spacing.md, paddingBottom: 48 }}>
          <View style={styles.modalHeader}>
            <Serif style={{ fontSize: 21 }}>
              {tab === "campaigns" ? "New campaign" : "New discount code"}
            </Serif>
            <Pressable onPress={() => setCreateOpen(false)} hitSlop={8}>
              <Ionicons name="close" size={22} color={colors.text} />
            </Pressable>
          </View>
          {tab === "campaigns" ? (
            <>
              <Field label="Name" placeholder="Autumn opening" value={campName} onChangeText={setCampName} />
              <Field
                label="Description (shown in the site banner)"
                value={campDesc}
                onChangeText={setCampDesc}
                style={{ marginTop: spacing.sm }}
              />
            </>
          ) : (
            <>
              <Field label="Code" placeholder="SUMMER10" autoCapitalize="characters" value={code} onChangeText={setCode} />
              <View style={{ flexDirection: "row", gap: 8, marginTop: spacing.md }}>
                <Chip label="Percent %" active={type === "percent"} onPress={() => setType("percent")} />
                <Chip label="Amount €" active={type === "amount"} onPress={() => setType("amount")} />
              </View>
              <Field
                label={type === "percent" ? "Percent off" : "Euro off"}
                keyboardType="decimal-pad"
                value={value}
                onChangeText={setValue}
                style={{ marginTop: spacing.sm }}
              />
              <Field
                label="Max redemptions (optional)"
                keyboardType="number-pad"
                value={maxRedemptions}
                onChangeText={setMaxRedemptions}
                style={{ marginTop: spacing.sm }}
              />
            </>
          )}
          <Button title="Create" loading={busy} onPress={create} style={{ marginTop: spacing.lg }} />
        </ScrollView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  tabs: {
    flexDirection: "row",
    margin: spacing.md,
    marginBottom: 0,
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 4,
  },
  tab: { flex: 1, paddingVertical: 9, borderRadius: radii.pill, alignItems: "center" },
  tabActive: { backgroundColor: colors.brand },
  tabText: { fontFamily: fonts.sansMedium, fontSize: 12.5, color: colors.muted },
  tabTextActive: { color: "#1d160f", fontFamily: fonts.sansSemiBold },
  rowTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  code: { fontFamily: fonts.sansBold, fontSize: 15, color: colors.gold, letterSpacing: 1 },
  campName: { fontFamily: fonts.sansSemiBold, fontSize: 14, color: colors.text },
  valuePill: {
    backgroundColor: colors.chip,
    borderRadius: radii.pill,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  valuePillText: { fontFamily: fonts.sansSemiBold, fontSize: 11, color: colors.sand },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 8 },
  modal: { flex: 1, backgroundColor: colors.bg },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
});
