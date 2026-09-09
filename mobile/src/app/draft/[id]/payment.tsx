import { Ionicons } from "@expo/vector-icons";
import { useStripe } from "@stripe/stripe-react-native";
import { BlurView } from "expo-blur";
import { router, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HoldCountdown } from "@/components/HoldCountdown";
import { Ornament } from "@/components/premium";
import { Button, Divider, Eyebrow, Field, Muted, Serif } from "@/components/ui";
import { colors, fonts, radii, shadows, spacing } from "@/constants/theme";
import { useApi } from "@/hooks/useApi";
import { api } from "@/lib/api";
import { config } from "@/lib/config";
import { formatDateTime, moneyCents, POLICY_MAP } from "@/lib/format";
import type { PromoValidation } from "@/lib/types";

import { StepDots } from "./attendees";

export default function PaymentScreen() {
  const { id, token, expiresAt } = useLocalSearchParams<{
    id: string;
    token: string;
    expiresAt?: string;
  }>();
  const insets = useSafeAreaInsets();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  const { data: envelope, loading, refresh } = useApi(
    () => api.getDraft(String(id), String(token)),
    [id, token]
  );

  const [promoInput, setPromoInput] = useState("");
  const [promo, setPromo] = useState<PromoValidation | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [paying, setPaying] = useState(false);

  const draft = envelope?.draft;
  const exp = envelope?.experience;
  const slot = envelope?.slot;

  // Redirect if this draft already completed payment.
  const draftStatus = draft?.status;
  useEffect(() => {
    if (draftStatus === "paid" || draftStatus === "converted") {
      router.replace({
        pathname: "/draft/[id]/confirmation",
        params: { id: String(id), token: String(token) },
      });
    }
  }, [draftStatus, id, token]);

  const pricing = useMemo(() => {
    const adults = draft?.counts?.adults ?? 0;
    const kids = draft?.counts?.kids ?? 0;
    const unitAdult = Math.round((draft?.unitPrices?.adult ?? draft?.unitPriceAdult ?? 0) * 100);
    const unitKid = Math.round((draft?.unitPrices?.kid ?? draft?.unitPriceKid ?? 0) * 100);
    const subtotal = adults * unitAdult + kids * unitKid;
    let discount = 0;
    if (promo) {
      if (promo.source === "giftcard") {
        discount = Math.min(promo.giftcard?.applyAmountCents ?? 0, subtotal);
      } else if (promo.discountType === "percent") {
        discount = Math.round((subtotal * promo.discountValue) / 100);
      } else {
        discount = Math.min(Math.round(promo.discountValue * 100), subtotal);
      }
    }
    const total = Math.max(0, subtotal - discount);
    // Prices are VAT-inclusive; the site displays a 24% VAT split.
    const net = Math.round(total / 1.24);
    return { adults, kids, unitAdult, unitKid, subtotal, discount, total, net, vat: total - net };
  }, [draft, promo]);

  async function applyPromo() {
    const code = promoInput.toUpperCase().replace(/[^A-Z0-9-]/g, "");
    if (!code) return;
    setValidating(true);
    setPromoError(null);
    try {
      const v = await api.validatePromo(code, String(id));
      setPromo(v);
    } catch (e) {
      setPromo(null);
      setPromoError(e instanceof Error ? e.message : "Invalid code");
    } finally {
      setValidating(false);
    }
  }

  function goToConfirmation(extra?: Record<string, string>) {
    router.replace({
      pathname: "/draft/[id]/confirmation",
      params: { id: String(id), token: String(token), ...extra },
    });
  }

  /** Native in-app payment via Stripe PaymentSheet (mode: "elements"). */
  async function payWithSheet() {
    const res = await api.checkoutDraft(String(id), promo?.code, "elements");
    if (res.mode === "free" || (res as any).zeroTotal) {
      goToConfirmation({ free: "1" });
      return;
    }
    if (!res.clientSecret) throw new Error("Could not start the payment.");

    const init = await initPaymentSheet({
      paymentIntentClientSecret: res.clientSecret,
      merchantDisplayName: "Oasis — Agrotourism & Wellness",
      defaultBillingDetails: { email: draft?.primary_contact?.email ?? undefined },
      returnURL: "oasis://stripe-redirect",
      appearance: {
        colors: {
          primary: colors.brand,
          background: colors.creamSoft,
          componentBackground: colors.white,
          componentBorder: colors.border,
          componentDivider: colors.border,
          primaryText: colors.brownDeep,
          secondaryText: colors.muted,
          placeholderText: colors.mutedWarm,
          icon: colors.brand,
        },
        shapes: { borderRadius: 14 },
        primaryButton: {
          colors: { background: colors.brand, text: colors.white },
          shapes: { borderRadius: 25 },
        },
      },
    });
    if (init.error) throw new Error(init.error.message);

    const result = await presentPaymentSheet();
    if (result.error) {
      if (result.error.code === "Canceled") return; // user closed the sheet
      throw new Error(result.error.message);
    }
    // Payment succeeded — convert the draft, then celebrate.
    try {
      await api.confirmDraft(String(id), {
        payment_intent: res.paymentIntentId,
      });
    } catch {
      // the confirmation screen polls and retries conversion
    }
    goToConfirmation({ paid: "1" });
  }

  /** Fallback: Stripe Checkout in the in-app browser. */
  async function payWithBrowser() {
    const res = await api.checkoutDraft(String(id), promo?.code, "checkout");
    if (res.mode === "free") {
      goToConfirmation({ free: "1" });
      return;
    }
    if (res.url) {
      router.push({
        pathname: "/draft/[id]/confirmation",
        params: { id: String(id), token: String(token) },
      });
      await WebBrowser.openBrowserAsync(res.url, { dismissButtonStyle: "close" });
      return;
    }
    throw new Error("Could not start the payment.");
  }

  async function pay() {
    setPaying(true);
    try {
      if (config.stripePublishableKey) {
        await payWithSheet();
      } else {
        await payWithBrowser();
      }
    } catch (e) {
      Alert.alert("Payment", e instanceof Error ? e.message : "Payment failed to start.");
      refresh();
    } finally {
      setPaying(false);
    }
  }

  if (loading || !draft) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  const policy =
    POLICY_MAP[(exp as any)?.cancellationPolicy ?? "strict"] ?? POLICY_MAP.strict;

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.md, paddingBottom: 150 }}
        showsVerticalScrollIndicator={false}
      >
        <StepDots step={3} />
        <Eyebrow style={{ marginTop: spacing.md }}>Step 3 of 3</Eyebrow>
        <Serif style={{ fontSize: 27 }}>Review & Pay</Serif>
        {exp && slot ? (
          <View style={styles.contextRow}>
            <Ionicons name="leaf-outline" size={13} color={colors.gold} />
            <Muted style={{ fontSize: 13 }}>
              {exp.name} · {formatDateTime(slot.date)}
            </Muted>
          </View>
        ) : null}

        <View style={{ marginTop: spacing.md }}>
          <HoldCountdown
            expiresAt={expiresAt || draft.expiresAt}
            onExpired={() =>
              Alert.alert(
                "Hold expired",
                "Your reserved spots have been released. Please choose your date again.",
                [{ text: "OK", onPress: () => router.dismissTo("/explore") }]
              )
            }
          />
        </View>

        {/* Order summary */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <Serif style={{ fontSize: 19 }}>Order Summary</Serif>
            <View style={styles.securePill}>
              <Ionicons name="lock-closed" size={10} color={colors.success} />
              <Text style={styles.secureText}>Secure</Text>
            </View>
          </View>
          <Row label={`Adults × ${pricing.adults}`} value={moneyCents(pricing.adults * pricing.unitAdult)} />
          {pricing.kids > 0 ? (
            <Row label={`Children × ${pricing.kids}`} value={moneyCents(pricing.kids * pricing.unitKid)} />
          ) : null}
          {pricing.discount > 0 ? (
            <Row
              label={`Discount (${promo?.code})`}
              value={`−${moneyCents(pricing.discount)}`}
              tone={colors.success}
            />
          ) : null}
          <Divider />
          <Row label="Net" value={moneyCents(pricing.net)} muted />
          <Row label="VAT (24%)" value={moneyCents(pricing.vat)} muted />
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{moneyCents(pricing.total)}</Text>
          </View>
          {(draft.attendees ?? []).length ? (
            <Muted style={{ marginTop: 10, fontSize: 12 }}>
              {(draft.attendees ?? [])
                .map((a) => [a.firstName, a.lastName].filter(Boolean).join(" "))
                .join(", ")}
            </Muted>
          ) : null}
        </View>

        {/* Promo */}
        <View style={styles.card}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Ionicons name="pricetag-outline" size={15} color={colors.gold} />
            <Text style={styles.cardTitle}>Promo or gift card</Text>
          </View>
          <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm }}>
            <Field
              placeholder="CODE"
              value={promoInput}
              onChangeText={(t) => setPromoInput(t.toUpperCase())}
              autoCapitalize="characters"
              style={{ flex: 1 }}
              error={promoError}
            />
            <Button
              title="Apply"
              variant="ghost"
              loading={validating}
              onPress={applyPromo}
              style={{ minHeight: 48, paddingVertical: 12 }}
            />
          </View>
          {promo ? (
            <View style={styles.promoApplied}>
              <Ionicons name="checkmark-circle" size={15} color={colors.success} />
              <Text style={styles.promoAppliedText}>
                {promo.code} applied{promo.source === "giftcard" ? " (gift card)" : ""}
              </Text>
              <Pressable onPress={() => { setPromo(null); setPromoInput(""); }}>
                <Text style={styles.removeText}>Remove</Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        {/* Policy agreement */}
        <View style={styles.card}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Ionicons name="document-text-outline" size={15} color={colors.gold} />
            <Text style={styles.cardTitle}>Cancellation policy — {policy.label}</Text>
          </View>
          <Muted style={{ marginTop: 6, lineHeight: 20 }}>{policy.description}</Muted>
          <Pressable style={styles.agreeRow} onPress={() => setAgreed((a) => !a)}>
            <Ionicons
              name={agreed ? "checkbox" : "square-outline"}
              size={22}
              color={agreed ? colors.brand : colors.mutedWarm}
            />
            <Text style={styles.agreeText}>
              I agree to the{" "}
              <Text
                style={{ color: colors.brand, fontFamily: fonts.sansSemiBold }}
                onPress={() => router.push("/cancellation-policy")}
              >
                Cancellation Policy
              </Text>
            </Text>
          </Pressable>
        </View>

        <Ornament style={{ marginTop: spacing.lg }} />
        <View style={styles.trustRow}>
          <Ionicons name="card-outline" size={14} color={colors.mutedWarm} />
          <Muted style={{ fontSize: 12, textAlign: "center" }}>
            Payment handled securely by Stripe — cards, Apple Pay & more.{"\n"}
            Your details never touch our servers.
          </Muted>
        </View>
      </ScrollView>

      {/* Frosted pay bar */}
      <View style={[styles.stickyWrap, { paddingBottom: insets.bottom + 8 }]}>
        <View style={styles.sticky}>
          <BlurView intensity={40} tint="extraLight" style={StyleSheet.absoluteFill} />
          <View style={styles.stickyTint} />
          <View style={{ flex: 1 }}>
            <Text style={styles.stickyTotal}>{moneyCents(pricing.total)}</Text>
            <Muted style={{ fontSize: 11 }}>VAT included</Muted>
          </View>
          <Button
            title={pricing.total === 0 ? "Confirm Booking" : `Pay ${moneyCents(pricing.total)}`}
            loading={paying}
            disabled={!agreed}
            onPress={pay}
            style={{ paddingHorizontal: 24 }}
          />
        </View>
      </View>
    </View>
  );
}

function Row({
  label,
  value,
  muted,
  tone,
}: {
  label: string;
  value: string;
  muted?: boolean;
  tone?: string;
}) {
  return (
    <View style={styles.row}>
      <Text
        style={[
          styles.rowLabel,
          muted && { color: colors.mutedWarm, fontSize: 12 },
          tone ? { color: tone } : null,
        ]}
      >
        {label}
      </Text>
      <Text
        style={[
          styles.rowValue,
          muted && { color: colors.mutedWarm, fontSize: 12 },
          tone ? { color: tone } : null,
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  center: { justifyContent: "center", alignItems: "center" },
  contextRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },

  summaryCard: {
    backgroundColor: colors.creamSoft,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSand,
    padding: spacing.md,
    marginTop: spacing.md,
    ...shadows.card,
  },
  summaryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  securePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.successSoft,
    borderRadius: radii.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  secureText: { fontFamily: fonts.sansSemiBold, fontSize: 10, color: colors.success },
  row: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  rowLabel: { fontFamily: fonts.sans, fontSize: 14, color: colors.muted },
  rowValue: { fontFamily: fonts.sansMedium, fontSize: 14, color: colors.ink },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
  },
  totalLabel: { fontFamily: fonts.sansBold, fontSize: 15, color: colors.brownDeep },
  totalValue: { fontFamily: fonts.serif, fontSize: 24, color: colors.brand },

  card: {
    backgroundColor: colors.creamSoft,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSand,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  cardTitle: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.brownDeep },
  promoApplied: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: spacing.sm,
  },
  promoAppliedText: { flex: 1, fontFamily: fonts.sansMedium, fontSize: 13, color: colors.success },
  removeText: { fontFamily: fonts.sansSemiBold, fontSize: 12, color: colors.danger },
  agreeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  agreeText: { flex: 1, fontFamily: fonts.sans, fontSize: 13, color: colors.ink },
  trustRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
  },

  stickyWrap: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.md,
  },
  sticky: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderRadius: radii.pill,
    overflow: "hidden",
    paddingVertical: 10,
    paddingLeft: spacing.lg,
    paddingRight: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSand,
    shadowColor: colors.brownDeeper,
    shadowOpacity: 0.18,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  stickyTint: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(253,250,245,0.75)",
  },
  stickyTotal: { fontFamily: fonts.serif, fontSize: 20, color: colors.brownDeep },
});
