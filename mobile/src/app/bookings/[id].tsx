import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import {
  ActivityIndicator,
  Linking,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import QRCode from "react-native-qrcode-svg";

import { Badge, Button, Card, Divider, EmptyState, Muted, Serif } from "@/components/ui";
import { colors, fonts, radii, spacing } from "@/constants/theme";
import { useApi } from "@/hooks/useApi";
import { api } from "@/lib/api";
import { bookingRef, formatDateTime, money } from "@/lib/format";

export default function BookingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: booking, loading, error, refresh } = useApi(
    () => api.myBooking(String(id)),
    [id]
  );
  const [copied, setCopied] = useState(false);

  if (loading) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }
  if (error || !booking) {
    return (
      <View style={styles.screen}>
        <EmptyState
          title="Booking not found"
          subtitle={error ?? "It may belong to a different account."}
        >
          <View style={{ gap: spacing.sm }}>
            <Button title="Try again" onPress={refresh} />
            <Button title="Guest Portal" variant="ghost" onPress={() => router.push("/manage-booking")} />
          </View>
        </EmptyState>
      </View>
    );
  }

  const name = booking.experience?.name ?? booking.experienceName ?? "Oasis Experience";
  const when = booking.startTime ?? booking.scheduleSlot?.date;
  const reference = bookingRef(booking);
  // Encode the same reference the ticket displays. A numeric id still scans,
  // but the two should not drift — and the id form is the one we would retire.
  const qrValue = booking.qrValue ?? `BOOKING-CHECKIN:${reference}`;
  const guests = (booking.counts?.adults ?? 0) + (booking.counts?.kids ?? 0);
  const location = booking.experience?.location ?? "Chania, Crete";

  async function copyRef() {
    await Clipboard.setStringAsync(reference);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function calendarUrl(): string | null {
    if (!when) return null;
    const start = new Date(when);
    const end = new Date(start.getTime() + (booking!.durationMinutes ?? 90) * 60000);
    const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
      `Oasis — ${name}`
    )}&dates=${fmt(start)}/${fmt(end)}&location=${encodeURIComponent(location)}`;
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: spacing.md, paddingBottom: 64 }}>
      {booking.experience?.images?.[0] ? (
        <Image
          source={{ uri: booking.experience.images[0] }}
          style={styles.cover}
          contentFit="cover"
        />
      ) : null}
      <View style={{ marginTop: spacing.md, gap: 6 }}>
        <Serif style={{ fontSize: 24 }}>{name}</Serif>
        <Badge label={booking.status ?? "unknown"} tone={
          ["paid", "confirmed", "approved", "completed", "checked_in"].includes(
            (booking.status ?? "").toLowerCase()
          )
            ? "success"
            : booking.status === "pending"
              ? "warning"
              : "danger"
        } />
      </View>

      {/* Ticket card with QR */}
      <Card style={styles.ticket}>
        <View style={{ alignItems: "center", gap: spacing.sm }}>
          <QRCode value={qrValue} size={160} color={colors.brownDeeper} backgroundColor="transparent" />
          <Text style={styles.reference} onPress={copyRef}>
            {reference} {copied ? "✓" : ""}
          </Text>
          <Muted style={{ fontSize: 11 }}>Tap the reference to copy · show the QR at check-in</Muted>
        </View>
      </Card>

      <Card style={{ marginTop: spacing.md }}>
        <DetailRow icon="calendar-outline" label="When" value={formatDateTime(when)} />
        <DetailRow icon="location-outline" label="Where" value={location} />
        {guests ? (
          <DetailRow
            icon="people-outline"
            label="Guests"
            value={`${booking.counts?.adults ?? 0} adults${
              booking.counts?.kids ? `, ${booking.counts.kids} children` : ""
            }`}
          />
        ) : null}
        {booking.totalPaidAmount != null ? (
          <DetailRow
            icon="card-outline"
            label="Paid"
            value={money(booking.totalPaidAmount, booking.currency)}
          />
        ) : null}
        {booking.appliedPromoCode ? (
          <DetailRow icon="pricetag-outline" label="Promo" value={booking.appliedPromoCode} />
        ) : null}
      </Card>

      <View style={{ gap: spacing.sm, marginTop: spacing.lg }}>
        <Button
          title="Download Ticket (PDF)"
          onPress={() => WebBrowser.openBrowserAsync(api.ticketPdfUrl(booking.id))}
        />
        {calendarUrl() ? (
          <Button title="Add to Calendar" variant="ghost" onPress={() => Linking.openURL(calendarUrl()!)} />
        ) : null}
        <Button
          title="Directions"
          variant="ghost"
          onPress={() =>
            Linking.openURL(
              `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`
            )
          }
        />
        <Button
          title="Add to Apple Wallet"
          variant="ghost"
          onPress={() => Linking.openURL(api.appleWalletUrl(booking.id))}
        />
        <Button
          title="Share"
          variant="ghost"
          onPress={() =>
            Share.share({ message: `My Oasis booking ${reference} — ${name}, ${formatDateTime(when)}` })
          }
        />
        <Divider />
        <Button
          title="Manage this booking"
          variant="sand"
          onPress={() => router.push("/manage-booking")}
        />
        <Muted style={{ fontSize: 12, textAlign: "center" }}>
          Reschedule, change pickup point, or request a cancellation in the Guest Portal
          using your reference and last name.
        </Muted>
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
  center: { justifyContent: "center", alignItems: "center" },
  cover: { width: "100%", height: 180, borderRadius: radii.lg },
  ticket: {
    marginTop: spacing.md,
    backgroundColor: colors.creamChip,
    borderStyle: "dashed",
    borderWidth: 1,
    borderColor: colors.gold,
  },
  reference: {
    fontFamily: fonts.sansBold,
    fontSize: 18,
    letterSpacing: 2,
    color: colors.brownDeep,
  },
  detailRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 },
  detailLabel: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.mutedWarm, width: 62 },
  detailValue: { flex: 1, fontFamily: fonts.sansSemiBold, fontSize: 14, color: colors.brownDeep },
});
