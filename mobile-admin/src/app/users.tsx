import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Linking,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { Badge, Card, EmptyState, ErrorState, ListSkeleton, Muted } from "@/components/ui";
import { colors, fonts, radii, spacing } from "@/constants/theme";
import { useApi } from "@/hooks/useApi";
import { api } from "@/lib/api";
import { PermissionGate } from "@/components/access";

function UsersScreenContent() {
  const { data, loading, error, refresh } = useApi(() => api.users());
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const list = data ?? [];
    if (!query.trim()) return list;
    const q = query.trim().toLowerCase();
    return list.filter((u) =>
      [u.name, u.surname, u.email, u.phone].filter(Boolean).join(" ").toLowerCase().includes(q)
    );
  }, [data, query]);

  return (
    <View style={styles.screen}>
      <View style={styles.search}>
        <Ionicons name="search-outline" size={16} color={colors.muted} />
        <TextInput
          placeholder="Search name, email, phone"
          placeholderTextColor={colors.faint}
          value={query}
          onChangeText={setQuery}
          style={styles.searchInput}
          autoCapitalize="none"
        />
      </View>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.gold} />
        </View>
      ) : error ? (
        <ErrorState title="Couldn't load users" message={error} onRetry={refresh} />
      ) : (
        <FlatList
          refreshControl={
            <RefreshControl
              refreshing={loading && !!data}
              onRefresh={refresh}
              tintColor={colors.gold}
            />
          }
          data={filtered}
          keyExtractor={(u) => String(u.id)}
          refreshing={false}
          onRefresh={refresh}
          contentContainerStyle={{ padding: spacing.md, gap: spacing.sm, paddingBottom: 48 }}
          renderItem={({ item: u }) => (
            <Card>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {(u.name?.[0] ?? u.email?.[0] ?? "?").toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name} numberOfLines={1}>
                    {[u.name, u.surname].filter(Boolean).join(" ") || u.email}
                  </Text>
                  <Muted style={{ fontSize: 12 }} numberOfLines={1}>
                    {u.email}
                    {u.phone ? ` · ${u.phone}` : ""}
                  </Muted>
                </View>
                {u.role && u.role !== "user" ? <Badge label={u.role} tone="info" /> : null}
                {u.phone ? (
                  <Ionicons
                    name="call-outline"
                    size={18}
                    color={colors.gold}
                    onPress={() => Linking.openURL(`tel:${u.phone}`)}
                  />
                ) : null}
              </View>
            </Card>
          )}
          ListEmptyComponent={<EmptyState title="No matches" />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    margin: spacing.md,
    marginBottom: 0,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.pill,
    paddingHorizontal: 14,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 11,
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.text,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.chip,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontFamily: fonts.serif, fontSize: 15, color: colors.gold },
  name: { fontFamily: fonts.sansSemiBold, fontSize: 14, color: colors.text },
});

export default function UsersScreen() {
  return (
    <PermissionGate permission="guests">
      <UsersScreenContent />
    </PermissionGate>
  );
}
