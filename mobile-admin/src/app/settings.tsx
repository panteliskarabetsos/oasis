import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from "react-native";

import { Button, Card, Chip, Eyebrow, Field, Muted, Serif } from "@/components/ui";
import { colors, spacing } from "@/constants/theme";
import { useApi } from "@/hooks/useApi";
import { api } from "@/lib/api";

export default function SettingsScreen() {
  const { data, loading, refresh } = useApi(() => api.bookingSettings());
  const [paused, setPaused] = useState(false);
  const [message, setMessage] = useState("");
  const [until, setUntil] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (data) {
      setPaused(Boolean(data.bookingsPaused));
      setMessage(data.bookingsPausedMessage ?? "");
      setUntil(data.bookingsPausedUntil ?? "");
    }
  }, [data]);

  async function save(next?: { paused?: boolean; until?: string | null }) {
    setBusy(true);
    try {
      await api.updateBookingSettings({
        bookingsPaused: next?.paused ?? paused,
        bookingsPausedMessage: message || null,
        bookingsPausedUntil: next?.until !== undefined ? next.until : until || null,
      });
      refresh();
      Alert.alert("Settings", "Saved.");
    } catch (e) {
      Alert.alert("Settings", e instanceof Error ? e.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  }

  function pauseFor(minutes: number) {
    const untilIso = new Date(Date.now() + minutes * 60000).toISOString();
    setPaused(true);
    setUntil(untilIso);
    save({ paused: true, until: untilIso });
  }

  if (loading) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator color={colors.gold} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: spacing.md, gap: spacing.md, paddingBottom: 64 }}>
      <Card>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <View style={{ flex: 1 }}>
            <Serif style={{ fontSize: 19 }}>Pause bookings</Serif>
            <Muted style={{ fontSize: 12, marginTop: 2 }}>
              The website stops taking new bookings while paused.
            </Muted>
          </View>
          <Switch
            value={paused}
            onValueChange={(v) => {
              setPaused(v);
              if (!v) setUntil("");
            }}
            trackColor={{ true: colors.danger }}
          />
        </View>

        <Eyebrow style={{ marginTop: spacing.md }}>Quick pause</Eyebrow>
        <View style={{ flexDirection: "row", gap: 8, marginTop: spacing.sm }}>
          <Chip label="30 min" onPress={() => pauseFor(30)} />
          <Chip label="2 hours" onPress={() => pauseFor(120)} />
          <Chip label="Today" onPress={() => pauseFor(60 * 12)} />
        </View>

        <Field
          label="Message shown to guests"
          placeholder="We're briefly closed — back soon."
          value={message}
          onChangeText={setMessage}
          style={{ marginTop: spacing.md }}
        />
        {until ? (
          <Muted style={{ marginTop: spacing.sm, fontSize: 12 }}>
            Resumes {new Date(until).toLocaleString("en-GB")}
          </Muted>
        ) : null}
        <Button title="Save" loading={busy} onPress={() => save()} style={{ marginTop: spacing.md }} />
      </Card>

      <Muted style={{ fontSize: 12, paddingHorizontal: 4 }}>
        Experience editing, invoices, e-shop, and email campaigns live on the web console — this app focuses
        on day-to-day operations.
      </Muted>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { justifyContent: "center", alignItems: "center" },
});
