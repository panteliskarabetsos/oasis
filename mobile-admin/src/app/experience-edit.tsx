import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";

import { Button, Chip, Divider, Eyebrow, Field, Muted, Serif } from "@/components/ui";
import { colors, fonts, radii, spacing } from "@/constants/theme";
import { useApi } from "@/hooks/useApi";
import { api } from "@/lib/api";
import type { AdminExperience, MeetupPoint } from "@/lib/types";

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const POLICIES = ["flexible", "moderate", "strict"] as const;

export default function ExperienceEditScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isNew = !id;
  const { data: all, loading } = useApi(() => api.adminExperiences());
  const existing = useMemo(
    () => (id ? (all ?? []).find((e) => String(e.id) === String(id)) : undefined),
    [all, id]
  );

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("Chania, Crete");
  const [duration, setDuration] = useState("");
  const [priceAdult, setPriceAdult] = useState("85");
  const [priceKid, setPriceKid] = useState("");
  const [policy, setPolicy] = useState<string>("strict");
  const [frequency, setFrequency] = useState<string[]>([]);
  const [visibility, setVisibility] = useState(false);
  const [whatsIncluded, setWhatsIncluded] = useState("");
  const [whatToBring, setWhatToBring] = useState("");
  const [whyYoullLove, setWhyYoullLove] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [meetups, setMeetups] = useState<MeetupPoint[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!existing) return;
    setName(existing.name ?? "");
    setDescription(existing.description ?? "");
    setLocation(existing.location ?? "Chania, Crete");
    setDuration(existing.duration ?? "");
    setPriceAdult(existing.priceAdult != null ? String(existing.priceAdult) : "");
    setPriceKid(existing.priceKid != null ? String(existing.priceKid) : "");
    setPolicy(existing.cancellationPolicy ?? "strict");
    setFrequency(
      Array.isArray(existing.frequency)
        ? existing.frequency
        : existing.frequency
          ? [existing.frequency]
          : []
    );
    setVisibility(Boolean(existing.visibility));
    setWhatsIncluded(existing.whatsIncluded ?? "");
    setWhatToBring(existing.whatToBring ?? "");
    setWhyYoullLove(existing.whyYoullLove ?? "");
    setImages(existing.images ?? []);
    setMeetups((existing.meetupPoints ?? []).filter(Boolean));
  }, [existing]);

  async function addPhotos() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: 6,
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.length) return;
    setUploading(true);
    try {
      const urls = await api.uploadImages(result.assets.map((a) => a.uri));
      if (!urls.length) throw new Error("Upload returned no URLs.");
      setImages((imgs) => [...imgs, ...urls]);
    } catch (e) {
      Alert.alert("Photos", e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  function updateMeetup(i: number, patch: Partial<MeetupPoint>) {
    setMeetups((m) => m.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  }

  async function save(publish?: boolean) {
    if (!name.trim()) {
      Alert.alert("Experience", "Give it a name.");
      return;
    }
    setSaving(true);
    const payload: Partial<AdminExperience> = {
      ...(existing ?? {}),
      id: existing?.id,
      name: name.trim(),
      description: description.trim(),
      location: location.trim() || "Chania, Crete",
      duration: duration.trim(),
      priceAdult: priceAdult ? Number(priceAdult) : null,
      priceKid: priceKid ? Number(priceKid) : null,
      cancellationPolicy: policy,
      frequency,
      visibility: publish ?? visibility,
      whatsIncluded,
      whatToBring,
      whyYoullLove,
      images,
      meetupPoints: meetups.filter((m) => m.name?.trim()),
    };
    try {
      if (isNew) {
        await api.createExperience(payload);
      } else {
        await api.updateExperience(payload as Partial<AdminExperience> & { id: number });
      }
      router.back();
    } catch (e) {
      Alert.alert("Experience", e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete() {
    if (!existing) return;
    Alert.alert("Delete experience", `Permanently delete “${existing.name}”?`, [
      { text: "Keep it", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await api.deleteExperience(existing.id);
            router.back();
          } catch (e) {
            Alert.alert("Delete", e instanceof Error ? e.message : "Failed.");
          }
        },
      },
    ]);
  }

  if (!isNew && loading && !existing) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator color={colors.gold} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 120 }}>
        <Serif style={{ fontSize: 24 }}>{isNew ? "New experience" : "Edit experience"}</Serif>
        {!isNew ? <Muted style={{ fontSize: 12 }}>{existing?.slug}</Muted> : null}

        {/* Basics */}
        <Eyebrow style={styles.section}>Basics</Eyebrow>
        <Field label="Name" value={name} onChangeText={setName} autoCapitalize="words" />
        <Field
          label="Description"
          value={description}
          onChangeText={setDescription}
          multiline
          inputStyle={{ minHeight: 110, textAlignVertical: "top" }}
          style={{ marginTop: spacing.sm }}
        />
        <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm }}>
          <Field label="Location" value={location} onChangeText={setLocation} style={{ flex: 1.4 }} />
          <Field label="Duration" placeholder="e.g. 5-6 Hours" value={duration} onChangeText={setDuration} style={{ flex: 1 }} />
        </View>

        {/* Pricing */}
        <Eyebrow style={styles.section}>Pricing (€)</Eyebrow>
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <Field label="Adult" keyboardType="decimal-pad" value={priceAdult} onChangeText={setPriceAdult} style={{ flex: 1 }} />
          <Field label="Child (optional)" keyboardType="decimal-pad" value={priceKid} onChangeText={setPriceKid} style={{ flex: 1 }} />
        </View>

        {/* Policy + schedule days */}
        <Eyebrow style={styles.section}>Cancellation policy</Eyebrow>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {POLICIES.map((p) => (
            <Chip
              key={p}
              label={p === "strict" ? "strict (bespoke)" : p}
              active={policy === p}
              onPress={() => setPolicy(p)}
            />
          ))}
        </View>

        <Eyebrow style={styles.section}>Runs on</Eyebrow>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {WEEKDAYS.map((d) => (
            <Chip
              key={d}
              label={d.slice(0, 3)}
              active={frequency.includes(d)}
              onPress={() =>
                setFrequency((f) => (f.includes(d) ? f.filter((x) => x !== d) : [...f, d]))
              }
            />
          ))}
        </View>

        {/* Content lists */}
        <Eyebrow style={styles.section}>Content (one item per line)</Eyebrow>
        <Field
          label="What's included"
          value={whatsIncluded}
          onChangeText={setWhatsIncluded}
          multiline
          inputStyle={{ minHeight: 84, textAlignVertical: "top" }}
        />
        <Field
          label="What to bring"
          value={whatToBring}
          onChangeText={setWhatToBring}
          multiline
          inputStyle={{ minHeight: 70, textAlignVertical: "top" }}
          style={{ marginTop: spacing.sm }}
        />
        <Field
          label="Why you'll love this"
          value={whyYoullLove}
          onChangeText={setWhyYoullLove}
          multiline
          inputStyle={{ minHeight: 70, textAlignVertical: "top" }}
          style={{ marginTop: spacing.sm }}
        />

        {/* Images */}
        <Eyebrow style={styles.section}>Photos</Eyebrow>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
          {images.map((uri, i) => (
            <View key={`${uri}-${i}`} style={styles.thumbWrap}>
              <Image source={{ uri }} style={styles.thumb} contentFit="cover" />
              {i === 0 ? (
                <View style={styles.coverBadge}>
                  <Text style={styles.coverBadgeText}>Cover</Text>
                </View>
              ) : null}
              <Pressable
                style={styles.thumbRemove}
                onPress={() => setImages((imgs) => imgs.filter((_, idx) => idx !== i))}
              >
                <Ionicons name="close" size={12} color={colors.white} />
              </Pressable>
              {i > 0 ? (
                <Pressable
                  style={styles.thumbUp}
                  onPress={() =>
                    setImages((imgs) => {
                      const next = [...imgs];
                      [next[i - 1], next[i]] = [next[i], next[i - 1]];
                      return next;
                    })
                  }
                >
                  <Ionicons name="arrow-back" size={12} color={colors.white} />
                </Pressable>
              ) : null}
            </View>
          ))}
          <Pressable style={styles.addThumb} onPress={addPhotos} disabled={uploading}>
            {uploading ? (
              <ActivityIndicator color={colors.gold} />
            ) : (
              <>
                <Ionicons name="camera-outline" size={20} color={colors.gold} />
                <Text style={styles.addThumbText}>Add</Text>
              </>
            )}
          </Pressable>
        </View>

        {/* Meetup points */}
        <Eyebrow style={styles.section}>Meeting points</Eyebrow>
        {meetups.map((m, i) => (
          <View key={i} style={styles.meetupCard}>
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <Field
                label="Name"
                value={m.name ?? ""}
                onChangeText={(t) => updateMeetup(i, { name: t })}
                style={{ flex: 1.4 }}
              />
              <Field
                label="Time"
                placeholder="08:30AM"
                value={m.time ?? ""}
                onChangeText={(t) => updateMeetup(i, { time: t })}
                style={{ flex: 1 }}
              />
            </View>
            <Field
              label="Map pin (lat, lng)"
              placeholder="35.5139, 24.0204"
              value={m.mapPin ?? ""}
              onChangeText={(t) => updateMeetup(i, { mapPin: t })}
              style={{ marginTop: spacing.sm }}
            />
            <Field
              label="Instructions (optional)"
              value={m.instructions ?? ""}
              onChangeText={(t) => updateMeetup(i, { instructions: t })}
              style={{ marginTop: spacing.sm }}
            />
            <Pressable
              onPress={() => setMeetups((ms) => ms.filter((_, idx) => idx !== i))}
              style={{ marginTop: spacing.sm, alignSelf: "flex-end" }}
            >
              <Text style={{ fontFamily: fonts.sansSemiBold, fontSize: 12, color: colors.danger }}>
                Remove point
              </Text>
            </Pressable>
          </View>
        ))}
        <Button
          title="+ Add meeting point"
          variant="ghost"
          onPress={() =>
            setMeetups((ms) => [...ms, { id: String(Date.now()), name: "", time: "", mapPin: "", instructions: "" }])
          }
          style={{ marginTop: spacing.sm }}
        />

        {/* Visibility */}
        <Divider style={{ marginTop: spacing.lg }} />
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.sansSemiBold, fontSize: 14, color: colors.text }}>
              Visible on the website
            </Text>
            <Muted style={{ fontSize: 12 }}>Hidden experiences stay as drafts.</Muted>
          </View>
          <Switch value={visibility} onValueChange={setVisibility} trackColor={{ true: colors.brand }} />
        </View>

        <View style={{ gap: spacing.sm, marginTop: spacing.lg }}>
          <Button title={visibility ? "Save & keep live" : "Save draft"} loading={saving} onPress={() => save()} />
          {!visibility ? (
            <Button title="Save & publish live" variant="success" loading={saving} onPress={() => save(true)} />
          ) : null}
          {!isNew ? (
            <Button title="Delete experience" variant="danger" onPress={confirmDelete} />
          ) : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { justifyContent: "center", alignItems: "center" },
  section: { marginTop: spacing.lg, marginBottom: spacing.sm },
  thumbWrap: { position: "relative" },
  thumb: { width: 86, height: 86, borderRadius: radii.md },
  coverBadge: {
    position: "absolute",
    bottom: 4,
    left: 4,
    backgroundColor: "rgba(23,18,13,0.75)",
    borderRadius: radii.pill,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  coverBadgeText: { fontFamily: fonts.sansBold, fontSize: 9, color: colors.sand },
  thumbRemove: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.danger,
    alignItems: "center",
    justifyContent: "center",
  },
  thumbUp: {
    position: "absolute",
    top: -6,
    left: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  addThumb: {
    width: 86,
    height: 86,
    borderRadius: radii.md,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.borderGold,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  addThumbText: { fontFamily: fonts.sansMedium, fontSize: 11, color: colors.gold },
  meetupCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
});
