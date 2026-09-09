import { ImageBackground, Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { Button, Card, Eyebrow, Muted, Serif } from "@/components/ui";
import { colors, fonts, radii, spacing } from "@/constants/theme";

const CONCEPTS = [
  {
    image: require("@/assets/oasis/private-chef.jpg"),
    title: "In-Villa Chef's Table",
    text: "A Cretan feast composed in your villa's kitchen — sourced that morning, told through every course.",
  },
  {
    image: require("@/assets/oasis/boat.jpg"),
    title: "Privatize a Tour",
    text: "Any signature experience, reserved entirely for your group and reshaped around your pace.",
  },
  {
    image: require("@/assets/oasis/proposal.jpg"),
    title: "Celebrations",
    text: "Proposals, milestones, and reunions — staged quietly in groves, gorges, and by the sea.",
  },
  {
    image: require("@/assets/oasis/reunion.jpg"),
    title: "Fully Bespoke",
    text: "Bring us a feeling; we'll design the day. Nothing is templated.",
  },
];

export default function PrivateScreen() {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: 64 }}>
      <ImageBackground
        source={require("@/assets/oasis/bespoke-hero.jpg")}
        style={styles.hero}
        contentFit="cover"
      >
        <LinearGradient colors={["rgba(0,0,0,0.2)", "rgba(0,0,0,0.6)"]} style={StyleSheet.absoluteFill} />
        <View style={{ padding: spacing.lg }}>
          <Eyebrow light>Private & In-Villa</Eyebrow>
          <Text style={styles.heroTitle}>Gatherings, made only once.</Text>
          <Muted style={{ color: "rgba(255,255,255,0.9)" }}>
            Intimate events curated with softness, space, and deep respect for our heritage.
          </Muted>
        </View>
      </ImageBackground>

      <View style={{ padding: spacing.md, gap: spacing.md }}>
        {CONCEPTS.map((c) => (
          <Card key={c.title} style={{ padding: 0, overflow: "hidden" }}>
            <Image source={c.image} style={{ width: "100%", height: 150 }} contentFit="cover" />
            <View style={{ padding: spacing.md, gap: 4 }}>
              <Serif style={{ fontSize: 20 }}>{c.title}</Serif>
              <Muted style={{ fontSize: 13 }}>{c.text}</Muted>
            </View>
          </Card>
        ))}
      </View>

      <View style={styles.ctaBand}>
        <Serif style={{ color: colors.creamSoft, fontSize: 22, textAlign: "center" }}>
          Tell us what you're imagining.
        </Serif>
        <Button
          title="Request Private Experience"
          variant="sand"
          onPress={() => router.push("/private-inquire")}
          style={{ marginTop: spacing.md }}
        />
        <Button
          title="Schedule a Clarity Call"
          variant="ghost"
          onPress={() => router.push("/contact")}
          style={{ marginTop: spacing.sm, borderColor: colors.creamSoft }}
          textStyle={{ color: colors.creamSoft }}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  hero: { height: 300, justifyContent: "flex-end" },
  heroTitle: {
    fontFamily: fonts.serif,
    fontSize: 28,
    lineHeight: 34,
    color: colors.creamSoft,
    marginVertical: 8,
  },
  ctaBand: {
    backgroundColor: colors.brownDeep,
    margin: spacing.md,
    borderRadius: radii.xl,
    padding: spacing.xl,
  },
});
