import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router, useFocusEffect } from "expo-router";
import { useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";

import { PressableScale } from "@/components/premium";
import { Badge, Button, EmptyState, Muted } from "@/components/ui";
import { colors, fonts, radii, shadows, spacing } from "@/constants/theme";
import { useApi } from "@/hooks/useApi";
import { api } from "@/lib/api";
import { PermissionGate } from "@/components/access";

function ExperiencesScreenContent() {
  const { data, loading, error, refresh } = useApi(() => api.adminExperiences());

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  async function toggleVisibility(id: number, visible: boolean) {
    try {
      await api.updateExperience({ id, visibility: visible });
      refresh();
    } catch (e) {
      Alert.alert("Experiences", e instanceof Error ? e.message : "Failed.");
    }
  }

  const items = data ?? [];
  const liveCount = items.filter((e) => e.visibility).length;

  return (
    <View style={styles.screen}>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.gold} />
        </View>
      ) : error ? (
        <EmptyState title="Couldn't load experiences" subtitle={error}>
          <Button title="Retry" variant="ghost" onPress={refresh} />
        </EmptyState>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: spacing.md, gap: spacing.md, paddingBottom: 64 }}
          refreshControl={<RefreshControl refreshing={false} onRefresh={refresh} tintColor={colors.gold} />}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
            <Muted style={{ flex: 1, fontSize: 13 }}>
              {liveCount} live · {items.length - liveCount} hidden
            </Muted>
            <Button
              title="+ New"
              onPress={() => router.push("/experience-edit")}
              style={{ minHeight: 40, paddingVertical: 9, paddingHorizontal: 18 }}
            />
          </View>

          {items.length === 0 ? (
            <EmptyState
              title="No experiences yet"
              subtitle="Create your first journey."
              icon="leaf-outline"
            />
          ) : (
            items.map((exp) => (
              <PressableScale
                key={exp.id}
                style={styles.card}
                onPress={() => router.push({ pathname: "/experience-edit", params: { id: String(exp.id) } })}
              >
                {exp.images?.[0] ? (
                  <Image source={{ uri: exp.images[0] }} style={styles.cover} contentFit="cover" transition={200} />
                ) : (
                  <View style={[styles.cover, styles.coverFallback]}>
                    <Ionicons name="leaf-outline" size={26} color={colors.gold} />
                  </View>
                )}
                <View style={{ flex: 1, padding: spacing.md, gap: 4 }}>
                  <Text style={styles.name} numberOfLines={2}>
                    {exp.name}
                  </Text>
                  <Muted style={{ fontSize: 12 }} numberOfLines={1}>
                    {exp.location || "Chania, Crete"}
                    {exp.duration ? ` · ${exp.duration}` : ""}
                  </Muted>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 }}>
                    <Text style={styles.price}>
                      {exp.priceAdult ? `€${Number(exp.priceAdult).toFixed(0)}` : "On request"}
                    </Text>
                    <Badge
                      label={exp.visibility ? "live" : "hidden"}
                      tone={exp.visibility ? "success" : "neutral"}
                    />
                  </View>
                </View>
                <View style={{ paddingRight: spacing.sm, alignItems: "center", gap: 4 }}>
                  <Switch
                    value={Boolean(exp.visibility)}
                    onValueChange={(v) => toggleVisibility(exp.id, v)}
                    trackColor={{ true: colors.brand }}
                  />
                  <Muted style={{ fontSize: 9 }}>{exp.visibility ? "Public" : "Draft"}</Muted>
                </View>
              </PressableScale>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: "hidden",
    ...shadows.soft,
  },
  cover: { width: 92, height: 104 },
  coverFallback: { backgroundColor: colors.chip, alignItems: "center", justifyContent: "center" },
  name: { fontFamily: fonts.serif, fontSize: 16, lineHeight: 20, color: colors.text },
  price: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.gold },
});

export default function ExperiencesScreen() {
  return (
    <PermissionGate permission="experiences">
      <ExperiencesScreenContent />
    </PermissionGate>
  );
}
