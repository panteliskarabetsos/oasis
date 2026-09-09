import { ScrollView, StyleSheet, Text, View } from "react-native";

import { Eyebrow, Muted, Serif } from "@/components/ui";
import { colors, fonts, spacing } from "@/constants/theme";

export type LegalSection = { title: string; paragraphs: string[] };

export function LegalPage({
  eyebrow,
  title,
  updated,
  intro,
  sections,
}: {
  eyebrow: string;
  title: string;
  updated?: string;
  intro?: string;
  sections: LegalSection[];
}) {
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ padding: spacing.md, paddingBottom: 64 }}
    >
      <Eyebrow>{eyebrow}</Eyebrow>
      <Serif style={{ fontSize: 26 }}>{title}</Serif>
      {updated ? <Muted style={{ marginTop: 4, fontSize: 12 }}>{updated}</Muted> : null}
      {intro ? <Text style={styles.paragraph}>{intro}</Text> : null}
      {sections.map((s, i) => (
        <View key={i} style={{ marginTop: spacing.lg }}>
          <Text style={styles.sectionTitle}>
            {i + 1}. {s.title}
          </Text>
          {s.paragraphs.map((p, j) => (
            <Text key={j} style={styles.paragraph}>
              {p}
            </Text>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  sectionTitle: {
    fontFamily: fonts.serif,
    fontSize: 18,
    color: colors.brownDeep,
    marginBottom: 4,
  },
  paragraph: {
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 22,
    color: colors.ink,
    marginTop: 8,
  },
});
