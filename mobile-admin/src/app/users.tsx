import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { FlatList, Linking, RefreshControl, StyleSheet, Text, View } from "react-native";

import { PermissionGate } from "@/components/access";
import { PressableScale } from "@/components/premium";
import { Screen } from "@/components/screen";
import {
  Avatar,
  Badge,
  Card,
  EmptyState,
  ErrorState,
  ListSkeleton,
  Muted,
  SearchBar,
} from "@/components/ui";
import { colors, fonts, spacing } from "@/constants/theme";
import { useApi } from "@/hooks/useApi";
import { api } from "@/lib/api";

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
    <Screen>
      <SearchBar
        placeholder="Search name, email, phone"
        value={query}
        onChangeText={setQuery}
        style={{ marginHorizontal: spacing.md, marginTop: spacing.sm }}
      />
      {loading && !data ? (
        <ListSkeleton />
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
              <View style={{ flexDirection: "row", alignItems: "center", gap: 11 }}>
                <Avatar name={[u.name, u.surname].filter(Boolean).join(" ") || u.email} />
                <View style={{ flex: 1, gap: 2 }}>
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
                  // A bare icon with an onPress has a ~18pt target; guides tap
                  // this one-handed with a phone already at their ear.
                  <PressableScale
                    style={styles.call}
                    onPress={() => Linking.openURL(`tel:${u.phone}`)}
                    accessibilityLabel={`Call ${u.name ?? "guest"}`}
                  >
                    <Ionicons name="call" size={16} color={colors.gold} />
                  </PressableScale>
                ) : null}
              </View>
            </Card>
          )}
          ListEmptyComponent={
            <EmptyState
              title="No matches"
              subtitle={query ? `Nothing matches "${query.trim()}".` : undefined}
              icon="people-outline"
            />
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  call: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.goldWash,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.goldLine,
  },
  name: { fontFamily: fonts.sansSemiBold, fontSize: 14.5, color: colors.text },
});

export default function UsersScreen() {
  return (
    <PermissionGate permission="guests">
      <UsersScreenContent />
    </PermissionGate>
  );
}
