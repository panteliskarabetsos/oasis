export default function generateViewport() {
  return {
    themeColor: [
      { media: "(prefers-color-scheme: light)", color: "#8b6f47" },
      { media: "(prefers-color-scheme: dark)", color: "#2b2a28" },
    ],
    width: "device-width",
    initialScale: 1,
    viewportFit: "cover",
  };
}
