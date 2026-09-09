import { Image } from "expo-image";
import { router } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { Badge, Button, Card, Eyebrow, Muted, Serif } from "@/components/ui";
import { colors, fonts, spacing } from "@/constants/theme";

// The website's retreats are a hard-coded editorial list; mirrored here.
const RETREATS = [
  {
    image: require("@/assets/oasis/outdoor-yoga.jpg"),
    name: "Spring Softness Retreat",
    tagline: "Bloom slowly, with the almond trees.",
    dates: "18–22 April 2025",
    location: "Near Chania",
    spots: "Limited to 10 guests",
    focus: "Gentle movement · herbal rituals · village tables",
    status: "Bookings open",
    tone: "success" as const,
  },
  {
    image: require("@/assets/oasis/fishing-boat.jpg"),
    name: "Slow Summer by the Sea",
    tagline: "Salt, shade, and long unhurried evenings.",
    dates: "5–9 June 2025",
    location: "West coast of Crete",
    spots: "Group of 12",
    focus: "Sea rituals · boat days · cooking with fire",
    status: "Early interest list",
    tone: "warning" as const,
  },
  {
    image: require("@/assets/oasis/mountain-3.jpg"),
    name: "Autumn Grounding Gathering",
    tagline: "Harvest, stillness, and mountain light.",
    dates: "October 2025",
    location: "Mountain village",
    spots: "Circle of 8",
    focus: "Olive harvest · quiet walks · fireside tables",
    status: "Dates announced soon",
    tone: "neutral" as const,
  },
];

export default function RetreatsScreen() {
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ padding: spacing.md, paddingBottom: 64 }}
    >
      <Eyebrow>Seasonal Gatherings</Eyebrow>
      <Serif style={{ fontSize: 28 }}>Retreats</Serif>
      <Muted style={{ marginTop: 4 }}>
        Small groups · gentle schedules · seasonal rhythms.
      </Muted>

      <View style={{ gap: spacing.md, marginTop: spacing.lg }}>
        {RETREATS.map((r) => (
          <Card key={r.name} style={{ padding: 0, overflow: "hidden" }}>
            <Image source={r.image} style={{ width: "100%", height: 170 }} contentFit="cover" />
            <View style={{ padding: spacing.md, gap: 6 }}>
              <Badge label={r.status} tone={r.tone} />
              <Serif style={{ fontSize: 21 }}>{r.name}</Serif>
              <Text style={styles.tagline}>{r.tagline}</Text>
              <Muted style={{ fontSize: 13 }}>
                {r.dates} · {r.location} · {r.spots}
              </Muted>
              <Muted style={{ fontSize: 13 }}>{r.focus}</Muted>
              <Button
                title="Express Interest"
                variant="ghost"
                onPress={() => router.push("/contact")}
                style={{ marginTop: spacing.sm }}
              />
            </View>
          </Card>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  tagline: {
    fontFamily: fonts.serifRegular,
    fontStyle: "italic",
    fontSize: 15,
    color: colors.brownDeep,
  },
});
