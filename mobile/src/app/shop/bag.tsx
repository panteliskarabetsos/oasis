import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useStripe } from "@stripe/stripe-react-native";
import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Ornament, successHaptic } from "@/components/premium";
import { Button, Divider, EmptyState, Eyebrow, Field, Muted, Serif } from "@/components/ui";
import { colors, fonts, radii, spacing } from "@/constants/theme";
import { lineKey, useBag, type BagLine } from "@/context/cart";
import { useAuth } from "@/context/auth";
import { api } from "@/lib/api";
import { config } from "@/lib/config";
import { moneyCents } from "@/lib/format";
import { COUNTRIES, findCountry } from "@/lib/countries";
import type { ShopDestination, ShopShippingQuote } from "@/lib/types";

const INK = "#26201a";
const DETAILS_KEY = "oasis.shop.details.v1";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Details = {
  name: string;
  email: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  postalCode: string;
  country: string;
  notes: string;
};

const EMPTY: Details = {
  name: "",
  email: "",
  phone: "",
  line1: "",
  line2: "",
  city: "",
  postalCode: "",
  country: "Greece",
  notes: "",
};

export default function BagScreen() {
  const insets = useSafeAreaInsets();
  const bag = useBag();
  const { profile } = useAuth();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  const [details, setDetails] = useState<Details>(EMPTY);
  const [touched, setTouched] = useState(false);
  const [paying, setPaying] = useState(false);
  const [method, setMethod] = useState<"courier" | "pickup">("courier");
  const [quote, setQuote] = useState<ShopShippingQuote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [notices, setNotices] = useState<string[]>([]);
  const [countryPicker, setCountryPicker] = useState(false);

  // Prefill from the last order, then from the signed-in profile — whichever
  // fills a field first wins, so a stored address is never overwritten.
  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(DETAILS_KEY)
      .then((raw) => {
        if (!alive) return;
        let stored: Partial<Details> = {};
        if (raw) {
          try {
            stored = JSON.parse(raw) ?? {};
          } catch {
            stored = {};
          }
        }
        setDetails((prev) => ({
          ...prev,
          ...stored,
          name:
            stored.name ||
            [profile?.name, profile?.surname].filter(Boolean).join(" ") ||
            prev.name,
          email: stored.email || profile?.email || prev.email,
          phone: stored.phone || profile?.phone || prev.phone,
        }));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [profile?.name, profile?.surname, profile?.email, profile?.phone]);

  const basketKey = useMemo(
    () => bag.lines.map((l) => `${l.productId}x${l.quantity}`).join(","),
    [bag.lines],
  );

  // Re-price delivery whenever the bag, the destination or the method changes.
  // Debounced because the country field is typed into.
  useEffect(() => {
    if (!bag.lines.length) {
      setQuote(null);
      return;
    }
    let alive = true;
    setQuoting(true);
    const t = setTimeout(() => {
      api
        .shopQuote({
          items: bag.lines.map((l) => ({ productId: l.productId, quantity: l.quantity })),
          country: details.country,
          method,
        })
        .then((q) => {
          if (!alive) return;
          setQuote(q);
          // The quote carries the shop's current view of every line, so a bag
          // that has gone stale corrects itself here rather than at payment.
          if (q.lines?.length) {
            const notes = bag.reconcile(
              q.lines.map((l) => ({
                productId: l.productId,
                available: l.available,
                priceCents: l.priceCents,
                stockQty: l.stockQty,
              })),
            );
            if (notes.length) setNotices(notes);
          }
        })
        .catch(() => alive && setQuote(null))
        .finally(() => alive && setQuoting(false));
    }, 400);
    return () => {
      alive = false;
      clearTimeout(t);
    };
    // Keyed on the contents rather than the array's identity: a re-created but
    // equal `lines` must not trigger another round trip.
  }, [basketKey, details.country, method]);

  function set<K extends keyof Details>(key: K, value: Details[K]) {
    setDetails((d) => ({ ...d, [key]: value }));
  }

  const errors = useMemo(() => {
    const e: Partial<Record<keyof Details, string>> = {};
    if (!details.name.trim()) e.name = "Required";
    if (!EMAIL_RE.test(details.email.trim())) e.email = "Enter a valid email";
    // Collecting in person needs no address.
    if (method === "courier") {
      if (!details.line1.trim()) e.line1 = "Required";
      if (!details.city.trim()) e.city = "Required";
      if (!details.postalCode.trim()) e.postalCode = "Required";
    }
    return e;
  }, [details, method]);

  // The shop's own list when it sends one — those are the countries it will
  // actually deliver to. Otherwise the bundled list, so the customer still
  // picks rather than types; the quote below then says whether we can ship.
  const serverDestinations: ShopDestination[] = quote?.destinations ?? [];
  const usingServerList = serverDestinations.length > 0;
  const destinations: ShopDestination[] = usingServerList
    ? serverDestinations
    : COUNTRIES.map((c) => ({ code: c.code, label: c.label, flag: c.flag }));

  const selectedDestination =
    destinations.find(
      (d) =>
        d.code.toUpperCase() === details.country.trim().toUpperCase() ||
        d.label.toLowerCase() === details.country.trim().toLowerCase(),
    ) ?? findCountry(details.country);

  const deliverable = quote ? quote.available : true;
  const valid = Object.keys(errors).length === 0 && deliverable;
  const shipping = quote?.available ? quote.cents : 0;
  const total = bag.subtotalCents + shipping;

  async function pay() {
    if (!valid) {
      setTouched(true);
      return;
    }
    setPaying(true);
    try {
      const payload = {
        items: bag.lines.map((l) => ({
          productId: l.productId,
          quantity: l.quantity,
          option: l.option,
        })),
        contact: {
          name: details.name.trim(),
          email: details.email.trim(),
          phone: details.phone.trim(),
        },
        shipping: {
          line1: details.line1.trim(),
          line2: details.line2.trim(),
          city: details.city.trim(),
          postalCode: details.postalCode.trim(),
          country: details.country.trim() || "Greece",
          notes: details.notes.trim(),
        },
      };

      await AsyncStorage.setItem(DETAILS_KEY, JSON.stringify(details)).catch(() => {});

      if (!config.stripePublishableKey) {
        const res = await api.shopCheckout({ ...payload, mode: "checkout", shippingMethod: method });
        if (!res.url) throw new Error("Could not start the payment.");
        await WebBrowser.openBrowserAsync(res.url, { dismissButtonStyle: "close" });
        // The webhook settles the order; the receipt screen polls for it.
        bag.clear();
        router.replace({
          pathname: "/shop/order/[id]",
          params: { id: String(res.orderId), email: payload.contact.email },
        });
        return;
      }

      const res = await api.shopCheckout({ ...payload, mode: "elements", shippingMethod: method });
      if (!res.clientSecret) throw new Error("Could not start the payment.");

      const init = await initPaymentSheet({
        paymentIntentClientSecret: res.clientSecret,
        merchantDisplayName: "Oasis — Agrotourism & Wellness",
        defaultBillingDetails: {
          name: payload.contact.name,
          email: payload.contact.email,
          phone: payload.contact.phone || undefined,
          address: {
            line1: payload.shipping.line1,
            line2: payload.shipping.line2 || undefined,
            city: payload.shipping.city,
            postalCode: payload.shipping.postalCode,
            country: /^(gr|greece|ελλ)/i.test(payload.shipping.country)
              ? "GR"
              : undefined,
          },
        },
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
        if (result.error.code === "Canceled") return; // sheet dismissed
        throw new Error(result.error.message);
      }

      try {
        await api.confirmShopOrder(res.orderId, res.paymentIntentId);
      } catch {
        // the receipt screen retries; the webhook is the safety net
      }
      successHaptic();
      bag.clear();
      router.replace({
        pathname: "/shop/order/[id]",
        params: { id: String(res.orderId), email: payload.contact.email, paid: "1" },
      });
    } catch (e) {
      Alert.alert("Checkout", e instanceof Error ? e.message : "Payment failed to start.");
    } finally {
      setPaying(false);
    }
  }

  if (bag.ready && bag.lines.length === 0 && !paying) {
    return (
      <View style={styles.screen}>
        <EmptyState
          title="Your bag is empty"
          subtitle="Olive oil, linen and small objects made a few valleys from here."
        >
          <Button title="Browse the shop" onPress={() => router.replace("/shop")} />
        </EmptyState>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      <ScrollView
        contentContainerStyle={{ padding: spacing.md, paddingBottom: 170 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Eyebrow>Your selection</Eyebrow>
        <Serif style={{ fontSize: 27 }}>The Bag</Serif>

        {notices.length ? (
          <View style={styles.noticeCard}>
            <Ionicons name="information-circle-outline" size={16} color={colors.warning} />
            <View style={{ flex: 1, gap: 3 }}>
              {notices.map((n, i) => (
                <Text key={i} style={styles.noticeText}>
                  {n}
                </Text>
              ))}
            </View>
            <Pressable hitSlop={8} onPress={() => setNotices([])}>
              <Ionicons name="close" size={15} color={colors.mutedWarm} />
            </Pressable>
          </View>
        ) : null}

        <View style={{ marginTop: spacing.md, gap: spacing.md }}>
          {bag.lines.map((line) => (
            <BagRow key={lineKey(line.productId, line.option)} line={line} />
          ))}
        </View>

        {/* Totals */}
        <View style={styles.card}>
          <Row label="Subtotal" value={moneyCents(bag.subtotalCents, bag.currency)} />
          <Row
            label={
              quote?.method === "free"
                ? "Delivery"
                : quote?.label || (method === "pickup" ? "Collection" : "Delivery")
            }
            value={
              quoting
                ? "…"
                : !quote
                  ? "—"
                  : !quote.available
                    ? "Unavailable"
                    : quote.cents === 0
                      ? quote.method === "free"
                        ? "Included"
                        : "Free"
                      : moneyCents(quote.cents, bag.currency)
            }
            muted
          />
          {quote && !quote.available ? (
            <Muted style={{ fontSize: 12, color: colors.danger, marginTop: 4 }}>
              {quote.reason}
            </Muted>
          ) : quote?.freeOverCents && !quote.free && quote.available && method === "courier" ? (
            <Muted style={{ fontSize: 12, marginTop: 4 }}>
              Spend {moneyCents(quote.freeOverCents - bag.subtotalCents, bag.currency)} more for
              free delivery.
            </Muted>
          ) : null}
          <Divider />
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{moneyCents(total, bag.currency)}</Text>
          </View>
        </View>

        {/* How it gets there */}
        {quote?.pickupOffered ? (
          <View style={styles.card}>
            <View style={styles.cardHead}>
              <Ionicons name="navigate-outline" size={15} color={colors.gold} />
              <Text style={styles.cardTitle}>How would you like it?</Text>
            </View>
            <View style={styles.methodRow}>
              {(
                [
                  ["courier", "Courier"],
                  ["pickup", quote.pickupLabel || "Collect"],
                ] as const
              ).map(([key, label]) => (
                <Pressable
                  key={key}
                  onPress={() => setMethod(key)}
                  style={[styles.methodBtn, method === key && styles.methodBtnOn]}
                >
                  <Text style={[styles.methodText, method === key && styles.methodTextOn]}>
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {/* Details */}
        <View style={styles.card}>
          <View style={styles.cardHead}>
            <Ionicons name="person-outline" size={15} color={colors.gold} />
            <Text style={styles.cardTitle}>Who is it for?</Text>
          </View>
          <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
            <Field
              label="Full name"
              value={details.name}
              onChangeText={(t) => set("name", t)}
              error={touched ? errors.name : null}
            />
            <Field
              label="Email"
              value={details.email}
              onChangeText={(t) => set("email", t)}
              autoCapitalize="none"
              keyboardType="email-address"
              error={touched ? errors.email : null}
            />
            <Field
              label="Phone (optional)"
              value={details.phone}
              onChangeText={(t) => set("phone", t)}
              keyboardType="phone-pad"
            />
          </View>
        </View>

        <View style={[styles.card, method === "pickup" && { display: "none" }]}>
          <View style={styles.cardHead}>
            <Ionicons name="cube-outline" size={15} color={colors.gold} />
            <Text style={styles.cardTitle}>Where should it go?</Text>
          </View>
          <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
            <Field
              label="Address"
              value={details.line1}
              onChangeText={(t) => set("line1", t)}
              error={touched ? errors.line1 : null}
            />
            <Field
              label="Apartment, floor (optional)"
              value={details.line2}
              onChangeText={(t) => set("line2", t)}
            />
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <Field
                label="City"
                value={details.city}
                onChangeText={(t) => set("city", t)}
                style={{ flex: 1.4 }}
                error={touched ? errors.city : null}
              />
              <Field
                label="Postcode"
                value={details.postalCode}
                onChangeText={(t) => set("postalCode", t)}
                style={{ flex: 1 }}
                error={touched ? errors.postalCode : null}
              />
            </View>
            <View>
              <Text style={styles.fieldLabel}>Country</Text>
              <Pressable
                onPress={() => setCountryPicker(true)}
                style={[
                  styles.countryButton,
                  quote && !quote.available ? styles.countryButtonBad : null,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Choose the delivery country"
              >
                <Text style={styles.countryText}>
                  {selectedDestination
                    ? `${selectedDestination.flag ?? ""} ${selectedDestination.label}`.trim()
                    : details.country || "Choose a country"}
                </Text>
                <Ionicons name="chevron-down" size={16} color={colors.mutedWarm} />
              </Pressable>
              {quote && !quote.available ? (
                <Text style={styles.countryError}>{quote.reason}</Text>
              ) : usingServerList ? (
                <Muted style={{ fontSize: 11.5, marginTop: 4 }}>
                  We deliver to {destinations.length} countr
                  {destinations.length === 1 ? "y" : "ies"}
                  {quote?.shipsAnywhere ? " and elsewhere on request" : ""}.
                </Muted>
              ) : null}
            </View>
            <Field
              label="Delivery notes (optional)"
              value={details.notes}
              onChangeText={(t) => set("notes", t)}
              multiline
              inputStyle={{ minHeight: 70, textAlignVertical: "top" }}
            />
          </View>
        </View>

        <Ornament style={{ marginTop: spacing.lg }} />
        <View style={styles.trustRow}>
          <Ionicons name="lock-closed-outline" size={13} color={colors.mutedWarm} />
          <Muted style={{ fontSize: 12, textAlign: "center" }}>
            Payment handled securely by Stripe — cards, Apple Pay & more.
          </Muted>
        </View>
      </ScrollView>

      <Modal
        visible={countryPicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setCountryPicker(false)}
      >
        <View style={styles.screen}>
          <View style={styles.pickerHead}>
            <View style={{ flex: 1 }}>
              <Eyebrow>Delivery</Eyebrow>
              <Serif style={{ fontSize: 22 }}>Where to?</Serif>
            </View>
            <Pressable onPress={() => setCountryPicker(false)} hitSlop={10}>
              <Ionicons name="close" size={20} color={colors.brownDeep} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 40 }}>
            {usingServerList ? (
              <Muted style={{ marginBottom: spacing.md, fontSize: 12.5 }}>
                These are the countries we deliver to.
              </Muted>
            ) : null}
            {!destinations.length ? (
              <Muted>
                No delivery countries are set up yet. Please contact us to arrange it.
              </Muted>
            ) : (
              destinations.map((d) => {
                const active =
                  d.code.toUpperCase() === details.country.toUpperCase() ||
                  d.label.toLowerCase() === details.country.trim().toLowerCase();
                return (
                  <Pressable
                    key={d.code}
                    onPress={() => {
                      set("country", d.label);
                      setCountryPicker(false);
                    }}
                    style={[styles.countryRow, active && styles.countryRowOn]}
                  >
                    <Text style={styles.countryFlag}>{d.flag}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.countryName}>{d.label}</Text>
                      {d.zoneLabel && d.zoneLabel !== d.label ? (
                        <Muted style={{ fontSize: 11.5 }}>{d.zoneLabel}</Muted>
                      ) : null}
                    </View>
                    {active ? (
                      <Ionicons name="checkmark" size={17} color={colors.brand} />
                    ) : null}
                  </Pressable>
                );
              })
            )}
          </ScrollView>
        </View>
      </Modal>

      <View style={[styles.stickyWrap, { paddingBottom: insets.bottom + 8 }]}>
        <View style={styles.sticky}>
          <BlurView intensity={40} tint="extraLight" style={StyleSheet.absoluteFill} />
          <View style={styles.stickyTint} />
          <View style={{ flex: 1 }}>
            <Text style={styles.stickyTotal}>{moneyCents(total, bag.currency)}</Text>
            <Muted style={{ fontSize: 11 }}>
              {bag.count} item{bag.count === 1 ? "" : "s"} · VAT included
            </Muted>
          </View>
          <Button
            title={`Pay ${moneyCents(total, bag.currency)}`}
            loading={paying}
            onPress={pay}
            style={{ paddingHorizontal: 22 }}
          />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function BagRow({ line }: { line: BagLine }) {
  const bag = useBag();
  const key = lineKey(line.productId, line.option);
  const ceiling = Math.min(20, line.stockQty > 0 ? line.stockQty : 20);

  return (
    <View style={styles.bagRow}>
      <Pressable onPress={() => router.push(`/shop/p/${line.slug}`)}>
        {line.image ? (
          <Image source={{ uri: line.image }} style={styles.thumb} contentFit="cover" />
        ) : (
          <View style={[styles.thumb, styles.thumbFallback]}>
            <Ionicons name="leaf-outline" size={16} color={colors.gold} />
          </View>
        )}
      </Pressable>

      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.lineTitle} numberOfLines={2}>
          {line.title}
        </Text>
        {line.option ? <Muted style={{ fontSize: 12 }}>{line.option}</Muted> : null}
        <Text style={styles.linePrice}>
          {moneyCents(line.priceCents * line.quantity, line.currency)}
        </Text>

        <View style={styles.lineControls}>
          <View style={styles.stepper}>
            <Pressable
              hitSlop={8}
              style={styles.stepButton}
              onPress={() => bag.setQuantity(key, line.quantity - 1)}
            >
              <Ionicons name="remove" size={15} color={INK} />
            </Pressable>
            <Text style={styles.qtyValue}>{line.quantity}</Text>
            <Pressable
              hitSlop={8}
              style={styles.stepButton}
              onPress={() => bag.setQuantity(key, Math.min(ceiling, line.quantity + 1))}
            >
              <Ionicons name="add" size={15} color={INK} />
            </Pressable>
          </View>
          <Pressable hitSlop={8} onPress={() => bag.remove(key)}>
            <Text style={styles.removeText}>Remove</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, muted && { color: colors.mutedWarm, fontSize: 12 }]}>
        {label}
      </Text>
      <Text style={[styles.rowValue, muted && { color: colors.mutedWarm, fontSize: 12 }]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },

  fieldLabel: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.brownDeep, marginBottom: 6 },
  countryButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    borderRadius: radii.md,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  countryText: { flex: 1, fontFamily: fonts.sans, fontSize: 15, color: colors.ink },
  countryButtonBad: { borderColor: colors.danger },
  countryError: { fontFamily: fonts.sans, fontSize: 12, color: colors.danger, marginTop: 4 },
  pickerHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  countryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: 13,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.creamSoft,
    marginBottom: 6,
  },
  countryRowOn: { borderColor: colors.brand, backgroundColor: colors.creamChip },
  countryFlag: { fontSize: 20 },
  countryName: { fontFamily: fonts.sansMedium, fontSize: 15, color: colors.ink },
  noticeCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    backgroundColor: colors.warningSoft,
    borderRadius: radii.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  noticeText: { fontFamily: fonts.sans, fontSize: 12.5, lineHeight: 18, color: colors.warning },
  bagRow: { flexDirection: "row", gap: spacing.md },
  thumb: { width: 78, height: 96, borderRadius: radii.md, backgroundColor: colors.creamChip },
  thumbFallback: { alignItems: "center", justifyContent: "center" },
  lineTitle: { fontFamily: fonts.serifRegular, fontSize: 17, lineHeight: 22, color: INK },
  linePrice: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.gold, marginTop: 2 },
  lineControls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.sm,
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSand,
    borderRadius: radii.pill,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  stepButton: { width: 26, height: 26, alignItems: "center", justifyContent: "center" },
  qtyValue: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 14,
    color: INK,
    minWidth: 16,
    textAlign: "center",
  },
  removeText: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.danger },

  card: {
    backgroundColor: colors.creamSoft,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSand,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  methodRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  methodBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 11,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSand,
    backgroundColor: colors.white,
  },
  methodBtnOn: { backgroundColor: INK, borderColor: INK },
  methodText: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.brownDeep },
  methodTextOn: { color: colors.creamSoft },
  cardTitle: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.brownDeep },

  row: { flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
  rowLabel: { fontFamily: fonts.sans, fontSize: 14, color: colors.muted },
  rowValue: { fontFamily: fonts.sansMedium, fontSize: 14, color: colors.ink },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  totalLabel: { fontFamily: fonts.sansBold, fontSize: 15, color: colors.brownDeep },
  totalValue: { fontFamily: fonts.serif, fontSize: 24, color: colors.brand },

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
    left: 0,
    right: 0,
    bottom: 0,
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
