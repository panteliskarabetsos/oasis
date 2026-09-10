import { Ionicons } from "@expo/vector-icons";
import { useStripe } from "@stripe/stripe-react-native";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PermissionGate } from "@/components/access";
import { ScreenHeader } from "@/components/screen";
import { PressableScale } from "@/components/premium";
import {
  Badge,
  Button,
  Card,
  Chip,
  ErrorState,
  Field,
  Muted,
  Serif,
} from "@/components/ui";
import { colors, fonts, radii, spacing } from "@/constants/theme";
import { useAuth } from "@/context/auth";
import { useApi } from "@/hooks/useApi";
import { api } from "@/lib/api";
import { config } from "@/lib/config";
import type {
  AdminSlot,
  PosCartLine,
  PosExperience,
  PosItem,
  PosPaymentLink,
} from "@/lib/types";

const VAT_RATE = 24;
const TENDER = [5, 10, 20, 50, 100];

const eur = (n: number) =>
  new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(n || 0);

const todayISO = () => new Date().toISOString().slice(0, 10);
const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

type Method = "card" | "link" | "cash" | "comp";

function PosContent() {
  const insets = useSafeAreaInsets();
  const { can } = useAuth();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  // Comping writes off the whole sale, so it is Super Admin only. The server
  // enforces this too — this just avoids offering something that will be refused.
  const canComp = can("comps");

  const { data: items, loading, error, refresh } = useApi(() => api.posItems());
  const { data: report } = useApi(() => api.dailyReport(todayISO()));
  const tillLocked = Boolean(report?.locked);

  const [mode, setMode] = useState<"items" | "experience">("items");
  const [category, setCategory] = useState("all");

  // Experience sale
  const { data: experiences } = useApi(() => api.posExperiences());
  const [expId, setExpId] = useState<number | null>(null);
  const [adults, setAdults] = useState(1);
  const [kids, setKids] = useState(0);
  const [slotId, setSlotId] = useState<number | null>(null);

  const experience = useMemo<PosExperience | null>(
    () => (experiences ?? []).find((x) => x.id === expId) ?? null,
    [experiences, expId],
  );

  // Slots for the next 30 days, with live availability.
  const slotRange = useMemo(() => {
    const from = new Date();
    const to = new Date(Date.now() + 30 * 86400000);
    return { from: from.toISOString(), to: to.toISOString() };
  }, []);

  const { data: slots, loading: slotsLoading } = useApi(
    async () => (expId ? api.schedule(expId, slotRange.from, slotRange.to) : []),
    [expId, slotRange.from, slotRange.to],
  );

  const openSlots = useMemo<AdminSlot[]>(
    () =>
      (slots ?? [])
        .filter((sl) => !sl.isCancelled)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [slots],
  );

  const selectedSlot = useMemo(
    () => openSlots.find((sl) => sl.id === slotId) ?? null,
    [openSlots, slotId],
  );

  const party = adults + kids;
  const seatsLeft = selectedSlot?.available ?? null;
  const overCapacity = seatsLeft !== null && party > seatsLeft;

  const [cart, setCart] = useState<Record<string, PosCartLine>>({});
  const [method, setMethod] = useState<Method>("card");
  const [linkSession, setLinkSession] = useState<PosPaymentLink | null>(null);
  const [cashGiven, setCashGiven] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!canComp && method === "comp") setMethod("card");
  }, [canComp, method]);

  useEffect(() => {
    setSlotId(null);
  }, [expId]);

  const categories = useMemo(() => {
    const set = new Set((items ?? []).map((i) => i.category).filter(Boolean));
    return ["all", ...Array.from(set).sort()];
  }, [items]);

  const visible = useMemo(
    () => (items ?? []).filter((i) => category === "all" || i.category === category),
    [items, category],
  );

  const lines = useMemo(() => Object.values(cart), [cart]);

  const expGross = useMemo(() => {
    if (mode !== "experience" || !experience) return 0;
    const a = experience.pricing?.priceAdult ?? 0;
    const k = experience.pricing?.priceKid ?? 0;
    return adults * a + kids * k;
  }, [mode, experience, adults, kids]);

  const gross = useMemo(
    () =>
      mode === "experience"
        ? expGross
        : lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0),
    [mode, expGross, lines],
  );
  const vat = useMemo(() => gross - gross / (1 + VAT_RATE / 100), [gross]);
  const toCharge = method === "comp" ? 0 : gross;
  const given = Number(cashGiven) || 0;
  const change = method === "cash" ? Math.max(0, given - toCharge) : 0;
  const cashShort = method === "cash" && given < toCharge;

  const add = useCallback((it: PosItem) => {
    setCart((prev) => {
      const cur = prev[it.id];
      const next = (cur?.quantity ?? 0) + 1;
      if (typeof it.stock === "number" && next > it.stock) {
        Alert.alert("Out of stock", `Only ${it.stock} of ${it.name} left.`);
        return prev;
      }
      return {
        ...prev,
        [it.id]: {
          id: it.id,
          name: it.name,
          sku: it.sku,
          unitPrice: it.price,
          quantity: next,
          vatRate: VAT_RATE,
          stock: typeof it.stock === "number" ? it.stock : null,
        },
      };
    });
  }, []);

  const setQty = useCallback((id: string | number, qty: number) => {
    setCart((prev) => {
      const line = prev[id];
      if (!line) return prev;
      if (qty <= 0) {
        const { [String(id)]: _drop, ...rest } = prev;
        return rest;
      }
      if (typeof line.stock === "number" && qty > line.stock) return prev;
      return { ...prev, [id]: { ...line, quantity: qty } };
    });
  }, []);

  const clear = () => {
    setCart({});
    setExpId(null);
    setSlotId(null);
    setAdults(1);
    setKids(0);
    setCashGiven("");
    setName("");
    setEmail("");
  };

  const blockers = useMemo(() => {
    const out: string[] = [];
    if (tillLocked) out.push("Today's Z-report is locked.");
    if (mode === "experience") {
      if (!experience) out.push("Choose an experience.");
      else if (!selectedSlot) out.push("Choose a departure.");
      else if (party < 1) out.push("Add at least one guest.");
      else if (overCapacity)
        out.push(`Only ${seatsLeft} seat${seatsLeft === 1 ? "" : "s"} left on that departure.`);
    } else if (!lines.length) {
      out.push("The cart is empty.");
    }
    if (!isEmail(email)) out.push("A customer email is required for the receipt.");
    if (cashShort) out.push("Cash received is less than the total.");
    return out;
  }, [
    tillLocked, mode, experience, selectedSlot, party, overCapacity, seatsLeft,
    lines.length, email, cashShort,
  ]);

  function payload(reference: string | null = null) {
    const isExp = mode === "experience";
    return {
      transactionType: isExp ? "experience" : "items",
      experienceId: isExp ? experience?.id ?? null : null,
      // The slot is what puts this sale on the daily manifest and consumes a seat.
      scheduleSlotId: isExp ? selectedSlot?.id ?? null : null,
      startTime: isExp ? selectedSlot?.date ?? null : null,
      counts: isExp ? { adults, kids } : null,
      items: isExp ? [] : lines.map((l) => ({
        id: l.id,
        name: l.name,
        sku: l.sku,
        unitPrice: l.unitPrice,
        quantity: l.quantity,
        vatRate: l.vatRate,
      })),
      manualDiscount: 0,
      promoCode: null,
      giftCode: null,
      payment: {
        method,
        reference,
        cashReceived: method === "cash" ? given : null,
        changeDue: method === "cash" ? change : null,
      },
      customer: { name: name.trim() || null, email: email.trim(), phone: null },
      currency: "eur",
      clientGross: gross,
      stripePaymentIntentId: null,
    };
  }

  /**
   * Open a Stripe Checkout Session and show its QR code.
   *
   * The customer scans and pays on their own phone; we poll until Stripe says
   * the money is in, then settle through the ordinary checkout so the sale is
   * recorded exactly as a card sale would be.
   */
  async function payByLink() {
    setBusy(true);
    try {
      const session = await api.posPaymentLink(payload());
      setLinkSession(session);
    } catch (e) {
      Alert.alert("Payment link", e instanceof Error ? e.message : "Could not create the link.");
    } finally {
      setBusy(false);
    }
  }

  /** Abandon a QR payment, expiring it at Stripe so it cannot be paid later. */
  async function cancelLink() {
    const session = linkSession;
    setLinkSession(null);
    if (!session?.sessionId) return;
    try {
      const res = await api.posPaymentLinkCancel(session.sessionId);
      // They paid in the moment it took to press Cancel — settle it anyway
      // rather than pocketing a payment with no receipt behind it.
      if (res.alreadyPaid && res.paymentIntentId) await settleLink(res.paymentIntentId);
    } catch {
      // The session expires on its own within 30 minutes.
    }
  }

  async function settleLink(paymentIntentId: string) {
    setLinkSession(null);
    setBusy(true);
    try {
      await finish({ ...payload(paymentIntentId), stripePaymentIntentId: paymentIntentId });
    } catch (e) {
      Alert.alert("Checkout", e instanceof Error ? e.message : "Checkout failed.");
    } finally {
      setBusy(false);
    }
  }

  async function finish(body: unknown) {
    const res = await api.posCheckout(body);
    clear();
    const receiptId = res?.receiptId ?? res?.bookingId;
    const mail = res?.receiptEmail;
    // The till insists on an email "for the receipt", so the cashier needs to
    // know whether it actually arrived before the customer walks away.
    const lines = [
      receiptId ? `Receipt #${receiptId}` : "Recorded.",
      mail?.sent
        ? `Emailed to ${mail.to}.`
        : mail && mail.reason !== "no-email"
          ? "The receipt email failed to send — resend it from the receipt."
          : null,
    ].filter(Boolean);
    Alert.alert("Sale complete", lines.join("\n"));
    refresh();
  }

  /** Card entry on this phone via Stripe's PaymentSheet. */
  async function payByCard() {
    if (!config.stripePublishableKey) {
      Alert.alert("Card payments unavailable", "No Stripe key is configured for this app.");
      return;
    }
    setBusy(true);
    try {
      const intent = await api.posPaymentIntent(payload());
      if (!intent?.clientSecret) throw new Error("Could not start the card payment.");

      const init = await initPaymentSheet({
        merchantDisplayName: "Oasis",
        paymentIntentClientSecret: intent.clientSecret,
        returnURL: "oasisadmin://stripe-redirect",
      });
      if (init.error) throw new Error(init.error.message);

      const sheet = await presentPaymentSheet();
      if (sheet.error) {
        // A cancelled sheet is not a failure worth shouting about.
        if (sheet.error.code !== "Canceled") Alert.alert("Payment failed", sheet.error.message);
        return;
      }
      await finish({ ...payload(intent.intentId ?? null), stripePaymentIntentId: intent.intentId });
    } catch (e) {
      Alert.alert("Card payment", e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function takePayment() {
    if (blockers.length) {
      Alert.alert("Not ready", blockers[0]);
      return;
    }
    if (method === "card") return payByCard();
    if (method === "link") return payByLink();

    if (method === "comp") {
      const ok = await new Promise<boolean>((resolve) =>
        Alert.alert(
          "Complimentary sale",
          `Write off ${eur(gross)}? This is recorded against your account.`,
          [
            { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
            { text: "Comp it", style: "destructive", onPress: () => resolve(true) },
          ],
        ),
      );
      if (!ok) return;
    }

    setBusy(true);
    try {
      await finish(payload());
    } catch (e) {
      Alert.alert("Checkout", e instanceof Error ? e.message : "Checkout failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader
          eyebrow="Revenue"
          title="Point of sale"
          trailing={
            <PressableScale onPress={() => router.back()} style={styles.close}>
              <Ionicons name="close" size={20} color={colors.textSoft} />
            </PressableScale>
          }
        />

        {tillLocked ? (
          <View style={styles.lockBanner}>
            <Ionicons name="lock-closed" size={15} color={colors.warning} />
            <Text style={styles.lockText}>
              Today&apos;s Z-report is locked — no new sales can be taken.
            </Text>
          </View>
        ) : null}

        <View style={styles.modeRow}>
          {([
            ["items", "Shop"],
            ["experience", "Experience"],
          ] as const).map(([m, label]) => (
            <PressableScale
              key={m}
              onPress={() => setMode(m)}
              style={[styles.modeTab, mode === m && styles.modeTabActive]}
            >
              <Text style={[styles.modeTabText, mode === m && { color: colors.bg }]}>
                {label}
              </Text>
            </PressableScale>
          ))}
        </View>

        {mode === "experience" ? (
          <View style={{ paddingHorizontal: spacing.md, gap: spacing.sm }}>
            <Card style={{ gap: 10 }}>
              <Text style={styles.sectionTitle}>Experience</Text>
              <View style={{ gap: 6 }}>
                {(experiences ?? []).map((x) => (
                  <PressableScale
                    key={x.id}
                    onPress={() => setExpId(x.id)}
                    style={[styles.expRow, expId === x.id && styles.expRowActive]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.expName}>{x.name}</Text>
                      <Muted style={{ fontSize: 11.5 }}>
                        {eur(x.pricing?.priceAdult ?? 0)} adult
                        {x.pricing?.priceKid ? ` · ${eur(x.pricing.priceKid)} child` : ""}
                      </Muted>
                    </View>
                    {expId === x.id ? (
                      <Ionicons name="checkmark-circle" size={18} color={colors.gold} />
                    ) : null}
                  </PressableScale>
                ))}
                {!experiences?.length ? (
                  <Muted style={{ fontSize: 13 }}>No bookable experiences.</Muted>
                ) : null}
              </View>
            </Card>

            {experience ? (
              <Card style={{ gap: 12 }}>
                <Text style={styles.sectionTitle}>Guests</Text>
                <Counter label="Adults" value={adults} onChange={setAdults} min={0} />
                <Counter label="Children" value={kids} onChange={setKids} min={0} />
                {party > 0 && seatsLeft !== null ? (
                  <Muted style={{ fontSize: 11.5 }}>
                    {party} guest{party === 1 ? "" : "s"} · {seatsLeft} seat
                    {seatsLeft === 1 ? "" : "s"} left on the selected departure
                  </Muted>
                ) : null}
              </Card>
            ) : null}

            {experience ? (
              <Card style={{ gap: 10 }}>
                <Text style={styles.sectionTitle}>Departure</Text>
                {slotsLoading ? (
                  <Muted style={{ fontSize: 13 }}>Loading departures…</Muted>
                ) : !openSlots.length ? (
                  <Muted style={{ fontSize: 13 }}>
                    Nothing scheduled for this experience in the next 30 days.
                  </Muted>
                ) : (
                  openSlots.map((sl) => {
                    const left = sl.available ?? 0;
                    const full = left <= 0;
                    const tooSmall = !full && party > left;
                    const when = new Date(sl.date);
                    return (
                      <PressableScale
                        key={sl.id}
                        disabled={full}
                        onPress={() => setSlotId(sl.id)}
                        style={[
                          styles.slotRow,
                          slotId === sl.id && styles.slotRowActive,
                          (full || tooSmall) && { opacity: 0.5 },
                        ]}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={styles.slotWhen}>
                            {when.toLocaleDateString("en-GB", {
                              weekday: "short",
                              day: "numeric",
                              month: "short",
                            })}
                            {"  "}
                            {when.toLocaleTimeString("en-GB", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </Text>
                          <Muted style={{ fontSize: 11.5 }}>
                            {left} of {sl.totalSlots ?? "—"} seats free
                          </Muted>
                        </View>
                        {full ? (
                          <Badge label="Full" tone="danger" />
                        ) : slotId === sl.id ? (
                          <Ionicons name="checkmark-circle" size={18} color={colors.gold} />
                        ) : null}
                      </PressableScale>
                    );
                  })
                )}
              </Card>
            ) : null}
          </View>
        ) : error ? (
          <View style={{ paddingHorizontal: spacing.md }}>
            <ErrorState title="Couldn't load products" message={error} onRetry={refresh} />
          </View>
        ) : (
          <>
            {categories.length > 2 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.cats}
              >
                {categories.map((c) => (
                  <Chip
                    key={c}
                    label={c === "all" ? "All" : c}
                    active={category === c}
                    onPress={() => setCategory(c)}
                  />
                ))}
              </ScrollView>
            ) : null}

            <View style={styles.grid}>
              {loading && !items ? (
                <Muted style={{ paddingHorizontal: spacing.md }}>Loading products…</Muted>
              ) : (
                visible.map((it) => {
                  const inCart = cart[it.id]?.quantity ?? 0;
                  const out = typeof it.stock === "number" && it.stock <= 0;
                  return (
                    <PressableScale
                      key={it.id}
                      disabled={out}
                      onPress={() => add(it)}
                      style={[styles.tile, inCart > 0 && styles.tileActive, out && styles.tileOut]}
                    >
                      {inCart > 0 ? (
                        <View style={styles.qtyBadge}>
                          <Text style={styles.qtyBadgeText}>{inCart}</Text>
                        </View>
                      ) : null}
                      <Text style={styles.tileName} numberOfLines={2}>
                        {it.name}
                      </Text>
                      <Text style={styles.tilePrice}>{eur(it.price)}</Text>
                      {out ? (
                        <Badge label="Out of stock" tone="danger" />
                      ) : typeof it.stock === "number" && it.stock <= 5 ? (
                        <Badge label={`${it.stock} left`} tone="warning" />
                      ) : null}
                    </PressableScale>
                  );
                })
              )}
            </View>
          </>
        )}

        {/* cart */}
        <Card style={{ marginHorizontal: spacing.md, marginTop: spacing.md, gap: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Text style={styles.sectionTitle}>Current sale</Text>
            {lines.length ? (
              <Button title="Clear" variant="ghost" onPress={clear} style={{ marginLeft: "auto" }} />
            ) : null}
          </View>

          {mode === "experience" ? (
            experience && selectedSlot ? (
              <View style={styles.cartRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cartName}>{experience.name}</Text>
                  <Muted style={{ fontSize: 11.5 }}>
                    {new Date(selectedSlot.date).toLocaleString("en-GB", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {" · "}
                    {adults} adult{adults === 1 ? "" : "s"}
                    {kids ? `, ${kids} child${kids === 1 ? "" : "ren"}` : ""}
                  </Muted>
                </View>
                <Text style={styles.cartTotal}>{eur(expGross)}</Text>
              </View>
            ) : (
              <Muted style={{ fontSize: 13 }}>
                Pick an experience and a departure to start.
              </Muted>
            )
          ) : !lines.length ? (
            <Muted style={{ fontSize: 13 }}>Tap a product to start.</Muted>
          ) : (
            lines.map((l) => (
              <View key={l.id} style={styles.cartRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cartName}>{l.name}</Text>
                  <Muted style={{ fontSize: 11.5 }}>{eur(l.unitPrice)} each</Muted>
                </View>
                <View style={styles.stepper}>
                  <PressableScale onPress={() => setQty(l.id, l.quantity - 1)} style={styles.stepBtn}>
                    <Text style={styles.stepText}>−</Text>
                  </PressableScale>
                  <Text style={styles.stepQty}>{l.quantity}</Text>
                  <PressableScale onPress={() => setQty(l.id, l.quantity + 1)} style={styles.stepBtn}>
                    <Text style={styles.stepText}>+</Text>
                  </PressableScale>
                </View>
                <Text style={styles.cartTotal}>{eur(l.unitPrice * l.quantity)}</Text>
              </View>
            ))
          )}

          <View style={styles.totalsBox}>
            <Row label="Net" value={eur(gross - vat)} />
            <Row label={`VAT ${VAT_RATE}%`} value={eur(vat)} />
            <View style={styles.grandRow}>
              <Text style={styles.grandLabel}>To pay</Text>
              <Text style={styles.grandValue}>{eur(toCharge)}</Text>
            </View>
          </View>
        </Card>

        {/* customer */}
        <Card style={{ marginHorizontal: spacing.md, marginTop: spacing.md, gap: 8 }}>
          <Text style={styles.sectionTitle}>Customer</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Name (optional)"
            placeholderTextColor={colors.faint}
            style={styles.input}
          />
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="Email for the receipt"
            placeholderTextColor={colors.faint}
            autoCapitalize="none"
            keyboardType="email-address"
            style={styles.input}
          />
        </Card>

        {/* payment */}
        <Card style={{ marginHorizontal: spacing.md, marginTop: spacing.md, gap: 10 }}>
          <Text style={styles.sectionTitle}>Payment</Text>
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            <MethodBtn
              label="Card on phone"
              icon="card-outline"
              active={method === "card"}
              onPress={() => setMethod("card")}
            />
            <MethodBtn
              label="Scan to pay"
              icon="qr-code-outline"
              active={method === "link"}
              onPress={() => setMethod("link")}
            />
            <MethodBtn
              label="Cash"
              icon="cash-outline"
              active={method === "cash"}
              onPress={() => setMethod("cash")}
            />
            {canComp ? (
              <MethodBtn
                label="Comp"
                icon="gift-outline"
                active={method === "comp"}
                onPress={() => setMethod("comp")}
              />
            ) : null}
          </View>

          {!canComp ? (
            <Muted style={{ fontSize: 11.5 }}>
              Complimentary sales are limited to Super Admins.
            </Muted>
          ) : null}

          {method === "cash" ? (
            <View style={{ gap: 8 }}>
              <Field label={`Cash received (EUR)`}>
                <TextInput
                  value={cashGiven}
                  onChangeText={setCashGiven}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={colors.faint}
                  style={styles.input}
                />
              </Field>
              <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
                <Chip label="Exact" onPress={() => setCashGiven(toCharge.toFixed(2))} />
                {TENDER.filter((n) => n >= toCharge)
                  .slice(0, 4)
                  .map((n) => (
                    <Chip key={n} label={`€${n}`} onPress={() => setCashGiven(String(n))} />
                  ))}
              </View>
              <View style={styles.changeRow}>
                <Text style={styles.changeLabel}>Change</Text>
                <Text style={[styles.changeValue, cashShort && { color: colors.danger }]}>
                  {cashShort ? `${eur(toCharge - given)} short` : eur(change)}
                </Text>
              </View>
            </View>
          ) : null}

          {method === "comp" ? (
            <Muted style={{ fontSize: 12 }}>
              Nothing will be charged. The sale is still recorded for the Z-report and
              attributed to you.
            </Muted>
          ) : null}
        </Card>

        {blockers.length && lines.length ? (
          <View style={styles.blockers}>
            {blockers.map((b) => (
              <Text key={b} style={styles.blockerText}>
                • {b}
              </Text>
            ))}
          </View>
        ) : null}

        <View style={{ paddingHorizontal: spacing.md, marginTop: spacing.md }}>
          <Button
            title={
              busy
                ? "Working…"
                : method === "comp"
                  ? `Comp ${eur(gross)}`
                  : method === "link"
                    ? `Show QR for ${eur(toCharge)}`
                    : `Charge ${eur(toCharge)}`
            }
            onPress={takePayment}
            disabled={busy || blockers.length > 0}
          />
        </View>
      </ScrollView>

      {linkSession ? (
        <LinkSheet
          session={linkSession}
          onCancel={cancelLink}
          onPaid={settleLink}
        />
      ) : null}
    </KeyboardAvoidingView>
  );
}

/**
 * The customer-facing half of a QR sale: hand the phone over, they scan.
 *
 * The QR arrives from the server as a PNG data URL, so this screen needs no
 * QR library of its own — and the app needs no new native dependency.
 */
function LinkSheet({
  session,
  onCancel,
  onPaid,
}: {
  session: PosPaymentLink;
  onCancel: () => void;
  onPaid: (paymentIntentId: string) => void;
}) {
  const [status, setStatus] = useState<"pending" | "paid" | "expired">("pending");
  const onPaidRef = useRef(onPaid);
  onPaidRef.current = onPaid;

  useEffect(() => {
    let alive = true;
    const timer = setInterval(async () => {
      try {
        const res = await api.posPaymentLinkStatus(session.sessionId);
        if (!alive) return;
        setStatus(res.status);
        if (res.status === "paid" && res.paymentIntentId) {
          clearInterval(timer);
          onPaidRef.current(res.paymentIntentId);
        }
        if (res.status === "expired") clearInterval(timer);
      } catch {
        // A dropped poll on retreat wifi is not a failed payment; retry next tick.
      }
    }, 2500);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [session.sessionId]);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.qrBackdrop}>
        <View style={styles.qrSheet}>
          <Serif style={{ fontSize: 22, textAlign: "center" }}>Scan to pay</Serif>
          <Muted style={{ textAlign: "center", marginTop: 6 }}>
            Ask the customer to scan this with their phone camera for{" "}
            {eur((session.amountCents || 0) / 100)}.
          </Muted>

          {status === "expired" ? (
            <View style={styles.qrExpired}>
              <Text style={styles.qrExpiredText}>
                This code has expired. Close and start again.
              </Text>
            </View>
          ) : (
            <View style={styles.qrFrame}>
              <Image source={{ uri: session.qrDataUrl }} style={styles.qrImage} />
            </View>
          )}

          {status === "paid" ? (
            <View style={styles.qrPaid}>
              <Ionicons name="checkmark-circle" size={16} color={colors.success} />
              <Text style={styles.qrPaidText}>Paid — finishing the sale…</Text>
            </View>
          ) : status === "pending" ? (
            <View style={styles.qrWaiting}>
              <ActivityIndicator color={colors.gold} size="small" />
              <Text style={styles.qrWaitingText}>Waiting for payment…</Text>
            </View>
          ) : null}

          <Button title="Cancel" variant="ghost" onPress={onCancel} />
        </View>
      </View>
    </Modal>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function Counter({
  label,
  value,
  onChange,
  min = 0,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
}) {
  return (
    <View style={styles.counterRow}>
      <Text style={styles.counterLabel}>{label}</Text>
      <View style={styles.stepper}>
        <PressableScale onPress={() => onChange(Math.max(min, value - 1))} style={styles.stepBtn}>
          <Text style={styles.stepText}>−</Text>
        </PressableScale>
        <Text style={styles.stepQty}>{value}</Text>
        <PressableScale onPress={() => onChange(value + 1)} style={styles.stepBtn}>
          <Text style={styles.stepText}>+</Text>
        </PressableScale>
      </View>
    </View>
  );
}

function MethodBtn({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  active: boolean;
  onPress: () => void;
}) {
  return (
    <PressableScale onPress={onPress} style={[styles.method, active && styles.methodActive]}>
      <Ionicons name={icon} size={16} color={active ? colors.bg : colors.textSoft} />
      <Text style={[styles.methodText, active && { color: colors.bg }]}>{label}</Text>
    </PressableScale>
  );
}

export default function PosScreen() {
  return (
    <PermissionGate permission="pos">
      <PosContent />
    </PermissionGate>
  );
}

const styles = StyleSheet.create({
  close: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  lockBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.warningSoft,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  lockText: { flex: 1, fontFamily: fonts.sansMedium, fontSize: 12.5, color: colors.warning },
  modeRow: {
    flexDirection: "row",
    gap: 6,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: 4,
  },
  modeTab: { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: radii.sm },
  modeTabActive: { backgroundColor: colors.gold },
  modeTabText: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.textSoft },
  expRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.surfaceHigh,
  },
  expRowActive: { borderColor: colors.gold },
  expName: { fontFamily: fonts.sansMedium, fontSize: 14, color: colors.text },
  slotRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.surfaceHigh,
  },
  slotRowActive: { borderColor: colors.gold },
  slotWhen: { fontFamily: fonts.sansMedium, fontSize: 14, color: colors.text },
  counterRow: { flexDirection: "row", alignItems: "center" },
  counterLabel: { flex: 1, fontFamily: fonts.sansMedium, fontSize: 14, color: colors.textSoft },
  cats: { gap: 8, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  tile: {
    width: "31%",
    minHeight: 92,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: 10,
    gap: 4,
  },
  tileActive: { borderColor: colors.brand, backgroundColor: colors.surfaceHigh },
  tileOut: { opacity: 0.45 },
  tileName: { fontFamily: fonts.sansMedium, fontSize: 12.5, color: colors.text },
  tilePrice: { fontFamily: fonts.sansSemiBold, fontSize: 13, color: colors.gold },
  qtyBadge: {
    position: "absolute",
    right: 6,
    top: 6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    zIndex: 2,
  },
  qtyBadgeText: { fontFamily: fonts.sansSemiBold, fontSize: 10.5, color: colors.bg },
  sectionTitle: { fontFamily: fonts.serif, fontSize: 17, color: colors.text },
  cartRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  cartName: { fontFamily: fonts.sansMedium, fontSize: 13.5, color: colors.text },
  cartTotal: { fontFamily: fonts.sansSemiBold, fontSize: 13.5, color: colors.text, minWidth: 62, textAlign: "right" },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radii.sm,
  },
  stepBtn: { paddingHorizontal: 10, paddingVertical: 3 },
  stepText: { fontFamily: fonts.sansMedium, fontSize: 16, color: colors.textSoft },
  stepQty: { fontFamily: fonts.sansSemiBold, fontSize: 13, color: colors.text, minWidth: 20, textAlign: "center" },
  totalsBox: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingTop: 8,
    gap: 4,
  },
  rowLabel: { fontFamily: fonts.sans, fontSize: 12.5, color: colors.muted },
  rowValue: { fontFamily: fonts.sans, fontSize: 12.5, color: colors.textSoft },
  grandRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginTop: 4,
  },
  grandLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.muted,
  },
  grandValue: { fontFamily: fonts.serif, fontSize: 24, color: colors.text },
  input: {
    backgroundColor: colors.surfaceHigh,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.text,
  },
  method: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surfaceHigh,
  },
  methodActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  methodText: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.textSoft },
  changeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingTop: 8,
  },
  changeLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.muted,
  },
  changeValue: { fontFamily: fonts.serif, fontSize: 20, color: colors.text },
  blockers: {
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    backgroundColor: colors.warningSoft,
    borderRadius: radii.md,
    padding: 12,
    gap: 3,
  },
  qrBackdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  qrSheet: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  // A white plate behind the code: scanners struggle with a dark quiet zone.
  qrFrame: {
    alignSelf: "center",
    backgroundColor: "#ffffff",
    borderRadius: radii.lg,
    padding: 12,
  },
  qrImage: { width: 240, height: 240 },
  qrWaiting: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  qrWaitingText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 11.5,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: colors.gold,
  },
  qrPaid: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  qrPaidText: { fontFamily: fonts.sansSemiBold, fontSize: 13, color: colors.success },
  qrExpired: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radii.md,
    paddingVertical: 22,
    paddingHorizontal: spacing.md,
  },
  qrExpiredText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 13,
    color: colors.danger,
    textAlign: "center",
  },
  blockerText: { fontFamily: fonts.sans, fontSize: 12.5, color: colors.warning },
});
