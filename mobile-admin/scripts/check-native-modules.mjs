#!/usr/bin/env node
/**
 * Fail if a native Expo module in package.json is missing from ios/Podfile.lock.
 *
 * Adding an Expo package that ships native code requires `npx pod-install`
 * before the next build. Skipping it produces an app that builds and bundles
 * cleanly, then hard-crashes the moment the JS touches the missing module —
 * exactly how expo-audio took down the check-in screen.
 *
 *   node scripts/check-native-modules.mjs
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const lockPath = "ios/Podfile.lock";

if (!existsSync(lockPath)) {
  console.log("No ios/Podfile.lock — managed workflow, nothing to check.");
  process.exit(0);
}
const lock = readFileSync(lockPath, "utf8");

/**
 * The podspec filename in node_modules/<dep>/ios is the authoritative pod name.
 * Guessing from the package name gets it wrong: expo-constants ships
 * EXConstants, expo-updates ships EXUpdates.
 */
function podNames(dep) {
  const dir = `node_modules/${dep}/ios`;
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".podspec"))
    .map((f) => f.replace(/\.podspec$/, ""));
}

const missing = [];
for (const dep of Object.keys(pkg.dependencies ?? {})) {
  if (!dep.startsWith("expo-")) continue;
  const pods = podNames(dep);
  if (!pods.length) continue; // JS-only package, nothing to link
  if (!pods.some((p) => lock.includes(`${p} (`) || lock.includes(`${p}:`)))
    missing.push({ dep, pod: pods.join(" / ") });
}

if (missing.length) {
  console.error("Native modules missing from ios/Podfile.lock:\n");
  for (const m of missing) console.error(`  ${m.dep}  (expected pod ${m.pod})`);
  console.error("\nRun:  npx pod-install\n");
  process.exit(1);
}
console.log(
  `All native Expo modules are in Podfile.lock (${Object.keys(pkg.dependencies ?? {}).filter((d) => d.startsWith("expo-")).length} expo packages checked).`,
);
