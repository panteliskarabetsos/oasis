import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { successHaptic } from "@/components/premium";
import { Button, Card, Divider, Muted, Serif } from "@/components/ui";
import { colors, fonts, radii, spacing } from "@/constants/theme";
import { api } from "@/lib/api";
import { bookingRef, formatDateTime, money } from "@/lib/format";
import type { DraftEnvelope } from "@/lib/types";

type Phase = "processing" | "success" | "failed";

export default function ConfirmationScreen() {
  const { id, token, free } = useLocalSearchParams<{
    id: string;
    token: string;
    free?: string;
  }>();
  const [phase, setPhase] = useState<Phase>("processing");
  const [envelope, setEnvelope] = useState<DraftEnvelope | null>(null);
  const [bookingId, setBookingId] = useState<number | null>(null);
  const confirmTried = useRef(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const check = useCallback(async () => {
    try {
      const env = await api.getDraft(String(id), String(token));
      setEnvelope(env);
      const draft = env.draft;
      const converted =
        draft?.status === "converted" || draft?.convertedBookingId || env.bookingId;
      if (converted) {
        setBookingId(env.bookingId ?? draft?.convertedBookingId ?? null);
        setPhase("success");
        if (pollRef.current) clearInterval(pollRef.current);
        return;
      }
      // Payment done in the browser but not yet converted: trigger /confirm
      // ourselves using the Stripe ids stamped on the draft (the website's
      // confirmation page normally does this).
      if (!confirmTried.current && (draft?.stripeSessionId || draft?.stripePaymentIntentId || free === "1")) {
        confirmTried.current = true;
        try {
          const res = await api.confirmDraft(String(id), {
            session_id: draft?.stripeSessionId ?? undefined,
            payment_intent: draft?.stripePaymentIntentId ?? undefined,
          });
          if (res.converted && res.bookingId) {
            setBookingId(res.bookingId);
            setPhase("success");
            if (pollRef.current) clearInterval(pollRef.current);
          }
        } catch {
          confirmTried.current = false; // payment may still be completing — retry on next poll
        }
      }
    } catch {
      // transient — keep polling
    }
  }, [id, token, free]);

  useEffect(() => {
    if (phase === "success") successHaptic();
  }, [phase]);

  useEffect(() => {
    check();
    pollRef.current = setInterval(check, 4000);
    const stopAfter = setTimeout(() => {
      if (pollRef.current) clearInterval(pollRef.current);
      setPhase((p) => (p === "processing" ? "failed" : p));
    }, 120000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      clearTimeout(stopAfter);
    };
  }, [check]);

  const exp = envelope?.experience;
  const slot = envelope?.slot;
  const draft = envelope?.draft;
  const reference = bookingRef(bookingId ?? draft?.convertedBookingId ?? 0);

  function calendarUrl(): string | null {
    if (!slot || !exp) return null;
    const start = new Date(slot.date);
    const end = new Date(start.getTime() + 90 * 60000);
    const fmt = (d: Date) =>
      d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
      `Oasis — ${exp.name}`
    )}&dates=${fmt(start)}/${fmt(end)}&location=${encodeURIComponent(exp.location ?? "Chania, Crete")}`;
  }

  if (phase === "processing") {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator color={colors.brand} size="large" />
        <Serif style={{ fontSize: 22, marginTop: spacing.lg, textAlign: "center" }}>
          Finalizing your booking…
        </Serif>
        <Muted style={{ textAlign: "center", marginTop: 8, paddingHorizontal: 40 }}>
          If you completed the payment, this only takes a moment. If you closed the
          payment window, you can go back and try again.
        </Muted>
        <Button
          title="I've completed payment — refresh"
          variant="ghost"
          onPress={check}
          style={{ marginTop: spacing.lg }}
        />
        <Button
          title="Back to payment"
          variant="ghost"
          onPress={() => router.back()}
          style={{ marginTop: spacing.sm }}
        />
      </View>
    );
  }

  if (phase === "failed") {
    return (
      <View style={[styles.screen, styles.center]}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.danger} />
        <Serif style={{ fontSize: 22, marginTop: spacing.md, textAlign: "center" }}>
          We couldn't confirm the payment
        </Serif>
        <Muted style={{ textAlign: "center", marginTop: 8, paddingHorizontal: 40 }}>
          If you were charged, your booking is safe — check your email or contact us
          and we'll sort it out.
        </Muted>
        <Button title="Try again" onPress={() => { setPhase("processing"); check(); }} style={{ marginTop: spacing.lg }} />
        <Button
          title="Contact us"
          variant="ghost"
          onPress={() => Linking.openURL("mailto:info@youroasis.gr?subject=Booking%20question")}
          style={{ marginTop: spacing.sm }}
        />
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: spacing.md, paddingBottom: 48 }}>
      <View style={styles.checkWrap}>
        <View style={styles.checkCircle}>
          <Ionicons name="checkmark" size={40} color={colors.white} />
        </View>
        <Serif style={{ fontSize: 26, textAlign: "center", marginTop: spacing.md }}>
          Your space is secured.
        </Serif>
        <Muted style={{ textAlign: "center", marginTop: 4 }}>
          A confirmation email with your ticket is on its way.
        </Muted>
      </View>

      <Card style={{ marginTop: spacing.lg }}>
        <View style={styles.refRow}>
          <Text style={styles.refLabel}>Reference</Text>
          <Text style={styles.refValue}>{reference}</Text>
        </View>
        <Divider />
        {exp ? <DetailRow icon="leaf-outline" label="Experience" value={exp.name} /> : null}
        {slot ? (
          <DetailRow icon="calendar-outline" label="When" value={formatDateTime(slot.date)} />
        ) : null}
        {exp?.location ? (
          <DetailRow icon="location-outline" label="Where" value={exp.location} />
        ) : null}
        {draft?.counts ? (
          <DetailRow
            icon="people-outline"
            label="Guests"
            value={`${draft.counts.adults} adult${draft.counts.adults === 1 ? "" : "s"}${
              draft.counts.kids ? `, ${draft.counts.kids} child${draft.counts.kids === 1 ? "" : "ren"}` : ""
            }`}
          />
        ) : null}
        {draft?.totalAmount != null ? (
          <DetailRow icon="card-outline" label="Total" value={money(draft.totalAmount)} />
        ) : null}
      </Card>

      <View style={{ gap: spacing.sm, marginTop: spacing.lg }}>
        {bookingId ? (
          <Button
            title="Download Ticket (PDF)"
            onPress={() => WebBrowser.openBrowserAsync(api.ticketPdfUrl(bookingId!))}
          />
        ) : null}
        {calendarUrl() ? (
          <Button
            title="Add to Calendar"
            variant="ghost"
            onPress={() => Linking.openURL(calendarUrl()!)}
          />
        ) : null}
        {bookingId ? (
          <Button
            title="Add to Apple Wallet"
            variant="ghost"
            onPress={() => Linking.openURL(api.appleWalletUrl(bookingId!))}
          />
        ) : null}
        <Button
          title="Explore More Experiences"
          variant="sand"
          onPress={() => router.dismissTo("/explore")}
        />
        <Button
          title="Questions? Email us"
          variant="ghost"
          onPress={() => Linking.openURL("mailto:info@youroasis.gr?subject=Booking%20question")}
        />
      </View>
    </ScrollView>
  );
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  value: string;
}) {
  return (
    <View style={styles.detailRow}>
      <Ionicons name={icon} size={16} color={colors.brand} />
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  center: { justifyContent: "center", alignItems: "center", padding: spacing.lg },
  checkWrap: { alignItems: "center", marginTop: spacing.lg },
  checkCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.success,
    alignItems: "center",
    justifyContent: "center",
  },
  refRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  refLabel: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.mutedWarm },
  refValue: {
    fontFamily: fonts.sansBold,
    fontSize: 16,
    color: colors.brownDeep,
    letterSpacing: 1,
    backgroundColor: colors.creamChip,
    borderRadius: radii.sm,
    paddingHorizontal: 10,
    paddingVertical: 4,
    overflow: "hidden",
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
  },
  detailLabel: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.mutedWarm, width: 82 },
  detailValue: { flex: 1, fontFamily: fonts.sansSemiBold, fontSize: 14, color: colors.brownDeep },
});
