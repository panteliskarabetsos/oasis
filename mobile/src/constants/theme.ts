// Oasis brand palette — mirrors the website's inline JSX palette
// (cream ground, deep-brown text, brown CTA, sand/gold highlights).

export const colors = {
  // Grounds
  cream: "#f4f1ec", // page background (matches web <body>)
  creamSoft: "#fdfaf5", // elevated surfaces
  creamChip: "#fbf7ef", // chips / subtle fills
  paper: "#FDFCF8", // experience-detail "luxury" ground
  white: "#ffffff",

  // Text
  ink: "#2f2f2f", // body text
  inkDeep: "#1A1A1A",
  brownDeep: "#5a4a3f", // headings / nav
  brownDeeper: "#4d3d33",
  muted: "#6b625a",
  mutedWarm: "#7a6a5f",

  // Brand accents
  brand: "#8b6f47", // primary CTA brown
  brandHover: "#7a5f3a",
  sand: "#e8d2b2", // hero CTA / highlight
  sandSoft: "#eddcb9",
  gold: "#b89a6b",
  goldLux: "#C8AA86", // experience-detail accent

  // Borders
  border: "#eae6e0",
  borderWarm: "#efe7d9",
  borderSand: "#e8dfcf",
  borderLux: "#EAE6DF",

  // Feedback
  danger: "#b3462e",
  dangerSoft: "#fbeae5",
  success: "#4c7a4c",
  successSoft: "#e9f2e9",
  warning: "#a3762a",
  warningSoft: "#f8efdd",

  // Overlays
  overlay: "rgba(0,0,0,0.55)",
  glass: "rgba(255,255,255,0.9)",
  glassDark: "rgba(0,0,0,0.25)",
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

// Minimal-luxury geometry: near-square corners, ornament through whitespace.
export const radii = {
  sm: 2,
  md: 4,
  lg: 8,
  xl: 12,
  pill: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

// Shadows all but disappear in the minimal look — depth comes from hairlines.
export const shadows = {
  card: {
    shadowColor: "#5a4a3f",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  soft: {
    shadowColor: "#5a4a3f",
    shadowOpacity: 0.03,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
} as const;
