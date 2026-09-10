// Oasis Admin — dark "operations console" variant of the brand palette.
// Espresso grounds, gold accents, Playfair headings over Inter data text.

export const colors = {
  // Grounds (dark). `bg` sits below `surface` so cards read as lifted, and
  // `bgDeep` is only for the ambient wash behind headers.
  bg: "#15100b",
  bgDeep: "#0e0a06",
  surface: "#211a13",
  surfaceHigh: "#2b2219",
  chip: "#332a1f",

  // Text
  text: "#f0e9df",
  textSoft: "#d8cdbd",
  muted: "#a4967f",
  faint: "#6f6350",

  // Brand accents
  brand: "#b89a6b",
  gold: "#c8aa86",
  sand: "#e8d2b2",
  sandSoft: "#eddcb9",
  brownDeep: "#5a4a3f",

  // Borders
  border: "#352b1f",
  borderGold: "#4d3f2c",

  // Translucent golds — icon tiles, active pills, hairlines over blur.
  goldWash: "rgba(200,170,134,0.12)",
  goldLine: "rgba(200,170,134,0.30)",

  // Feedback
  success: "#7fb069",
  successSoft: "#243020",
  warning: "#d9a441",
  warningSoft: "#332a15",
  danger: "#d96b53",
  dangerSoft: "#361f19",
  info: "#7da7c9",
  infoSoft: "#1e2831",

  // Overlays
  overlay: "rgba(0,0,0,0.55)",
  glass: "rgba(33,26,19,0.85)",
  white: "#ffffff",

  /** Text that sits *on* gold — the only near-black in the palette. */
  onGold: "#1d160f",
} as const;

export const fonts = {
  serif: "PlayfairDisplay_600SemiBold",
  serifBold: "PlayfairDisplay_700Bold",
  serifRegular: "PlayfairDisplay_400Regular",
  sans: "Inter_400Regular",
  sansMedium: "Inter_500Medium",
  sansSemiBold: "Inter_600SemiBold",
  sansBold: "Inter_700Bold",
} as const;

export const radii = { sm: 8, md: 12, lg: 18, xl: 26, pill: 999 } as const;

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 } as const;

/** Gradient ramps, kept here so gold reads the same everywhere it is poured. */
export const gradients = {
  gold: ["#cbb086", "#b89a6b", "#9d7f52"],
  /** Warm light bleeding down from the top of a screen. */
  ambient: ["rgba(184,154,107,0.16)", "rgba(184,154,107,0.04)", "rgba(21,16,11,0)"],
  /** Card sheen — a barely-there highlight along the top edge. */
  sheen: ["rgba(240,233,223,0.055)", "rgba(240,233,223,0)"],
} as const;

export const shadows = {
  card: {
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  soft: {
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  lifted: {
    shadowColor: "#000",
    shadowOpacity: 0.45,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
} as const;

export type Tone = "neutral" | "success" | "warning" | "danger" | "info" | "gold";

/** One place that answers "what colour is this tone?", so screens stop
 *  re-deriving it with a chain of ternaries. */
export function toneColors(tone: Tone = "neutral") {
  switch (tone) {
    case "success":
      return { fg: colors.success, bg: colors.successSoft };
    case "warning":
      return { fg: colors.warning, bg: colors.warningSoft };
    case "danger":
      return { fg: colors.danger, bg: colors.dangerSoft };
    case "info":
      return { fg: colors.info, bg: colors.infoSoft };
    case "gold":
      return { fg: colors.gold, bg: colors.goldWash };
    default:
      return { fg: colors.textSoft, bg: colors.chip };
  }
}

/** Height of the floating tab bar's visible pill, excluding the home
 *  indicator. Screens add this to their bottom inset so the last row is
 *  never parked under the blur. */
export const TAB_BAR_HEIGHT = 58;
