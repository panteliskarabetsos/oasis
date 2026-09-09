import { Image, ImageBackground } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { Button, Card, Eyebrow, Muted, Serif } from "@/components/ui";
import { colors, fonts, radii, spacing } from "@/constants/theme";

const FOUNDATIONS = [
  {
    n: "01",
    title: "Authentic Heritage",
    text: "Every experience is rooted in real Cretan tradition — hosted by the people who live it.",
  },
  {
    n: "02",
    title: "Mindful Exploration",
    text: "We travel gently: small groups, slow mornings, and space to simply be.",
  },
  {
    n: "03",
    title: "Living Land",
    text: "Olive groves, mountain herbs, and the sea shape our days more than any itinerary.",
  },
  {
    n: "04",
    title: "Quiet Luxury",
    text: "Comfort without excess — thoughtful details over spectacle.",
  },
];

const TEAM = [
  { image: require("@/assets/oasis/team1.jpg"), name: "The Hosts" },
  { image: require("@/assets/oasis/team2.jpg"), name: "The Kitchen" },
  { image: require("@/assets/oasis/team3.jpg"), name: "The Land" },
];

export default function AboutScreen() {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: 64 }}>
      <ImageBackground
        source={require("@/assets/oasis/village-1.jpg")}
        style={styles.hero}
        contentFit="cover"
      >
        <LinearGradient colors={["rgba(0,0,0,0.15)", "rgba(0,0,0,0.55)"]} style={StyleSheet.absoluteFill} />
        <View style={{ padding: spacing.lg }}>
          <Eyebrow light>Our Story</Eyebrow>
          <Text style={styles.heroTitle}>
            A return to the <Text style={{ fontStyle: "italic", color: colors.sand }}>rhythm</Text> of Crete.
          </Text>
        </View>
      </ImageBackground>

      <View style={{ padding: spacing.md }}>
        <Eyebrow>Our Philosophy</Eyebrow>
        <Serif style={{ fontSize: 24, marginTop: 6 }}>Rooted, soulful, slow travel.</Serif>
        <Muted style={{ marginTop: spacing.sm }}>
          Oasis grew from a simple belief: that the deepest luxury is time — time to
          knead bread with a grandmother in a mountain village, to walk a gorge in
          silence, to sit at a long table as the light goes gold. We curate intimate
          retreats, unhurried days, and thoughtful gatherings in and around Chania,
          with softness, space, and deep respect for our heritage.
        </Muted>

        <Text style={styles.pullQuote}>
          “Filoxenia is not a service. It is the Cretan way of loving a stranger.”
        </Text>

        <Eyebrow style={{ marginTop: spacing.lg }}>The Foundations</Eyebrow>
        <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
          {FOUNDATIONS.map((f) => (
            <Card key={f.n}>
              <Text style={styles.number}>{f.n}</Text>
              <Serif style={{ fontSize: 19, marginTop: 2 }}>{f.title}</Serif>
              <Muted style={{ marginTop: 4 }}>{f.text}</Muted>
            </Card>
          ))}
        </View>

        <Eyebrow style={{ marginTop: spacing.lg }}>The People</Eyebrow>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.sm }}
        >
          {TEAM.map((t) => (
            <View key={t.name} style={{ alignItems: "center", gap: 6 }}>
              <Image source={t.image} style={styles.teamImage} contentFit="cover" />
              <Muted style={{ fontSize: 12 }}>{t.name}</Muted>
            </View>
          ))}
        </ScrollView>

        <View style={styles.ctaBand}>
          <Serif style={{ color: colors.creamSoft, fontSize: 22, textAlign: "center" }}>
            Come as a guest. Leave as family.
          </Serif>
          <Button
            title="Discover Experiences"
            variant="sand"
            onPress={() => router.push("/explore")}
            style={{ marginTop: spacing.md }}
          />
          <Button
            title="Private Gatherings"
            variant="ghost"
            onPress={() => router.push("/private")}
            style={{ marginTop: spacing.sm, borderColor: colors.creamSoft }}
            textStyle={{ color: colors.creamSoft }}
          />
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  hero: { height: 300, justifyContent: "flex-end" },
  heroTitle: {
    fontFamily: fonts.serif,
    fontSize: 30,
    lineHeight: 38,
    color: colors.creamSoft,
    marginTop: 8,
  },
  pullQuote: {
    fontFamily: fonts.serifRegular,
    fontStyle: "italic",
    fontSize: 19,
    lineHeight: 28,
    color: colors.brownDeep,
    textAlign: "center",
    marginVertical: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  number: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.gold, letterSpacing: 2 },
  teamImage: { width: 110, height: 130, borderRadius: radii.md },
  ctaBand: {
    backgroundColor: colors.brownDeep,
    borderRadius: radii.xl,
    padding: spacing.xl,
    marginTop: spacing.lg,
  },
});
