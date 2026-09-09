// Oasis Admin — dark "operations console" variant of the brand palette.
// Espresso grounds, gold accents, Playfair headings over Inter data text.

export const colors = {
  // Grounds (dark)
  bg: "#17120d",
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
} as const;
