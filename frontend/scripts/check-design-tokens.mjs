import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// WCAG relative luminance: convert opaque OKLCH tokens through linear sRGB.
// This checks token pairs, not alpha compositing, imagery or rendered accessibility.
const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
const roles = ["success", "warning", "info", "destructive"];
const tokens = [
  "brand-highlight",
  "brand-highlight-foreground",
  ...roles.flatMap((role) => [role, `${role}-foreground`, `${role}-muted`]),
];
for (const token of tokens) {
  assert.ok(css.includes(`--color-${token}: var(--${token})`), `Missing theme mapping: ${token}`);
}

function luminance(value) {
  const match = /^oklch\(([\d.]+) ([\d.]+) ([\d.]+)\)$/.exec(value);
  assert.ok(match, `Expected opaque OKLCH, received ${value}`);
  const [, lightness, chroma, hue] = match.map(Number);
  const a = chroma * Math.cos((hue * Math.PI) / 180);
  const b = chroma * Math.sin((hue * Math.PI) / 180);
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const linear = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  assert.ok(
    linear.every((channel) => channel >= -0.001 && channel <= 1.001),
    `Out-of-sRGB token needs browser gamut verification: ${value}`,
  );
  const [red, green, blue] = linear.map((channel) => Math.min(1, Math.max(0, channel)));
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

// Black/white is 21:1; achromatic L=0.5 has linear luminance 0.125.
assert.equal(luminance("oklch(0 0 0)"), 0);
assert.ok(Math.abs(luminance("oklch(1 0 0)") - 1) < 1e-6);
assert.ok(Math.abs(luminance("oklch(0.5 0 0)") - 0.125) < 1e-6);

const pairs = [
  ["foreground", "background", 4.5],
  ["card-foreground", "card", 4.5],
  ["popover-foreground", "popover", 4.5],
  ["primary-foreground", "primary", 4.5],
  ["secondary-foreground", "secondary", 4.5],
  ["accent-foreground", "accent", 4.5],
  ["muted-foreground", "background", 4.5],
  ["muted-foreground", "card", 4.5],
  ["muted-foreground", "muted", 4.5],
  ["brand-highlight-foreground", "brand-highlight", 4.5],
  ...roles.flatMap((role) => [
    [role, `${role}-muted`, 4.5],
    [`${role}-foreground`, role, 4.5],
    [role, "background", 4.5],
    [role, "card", 4.5],
  ]),
  ["ring", "background", 3],
  ["ring", "card", 3],
  ["input", "background", 3],
  ["input", "card", 3],
];

let failed = false;
for (const theme of [":root", ".dark"]) {
  const block = css.match(new RegExp(`${theme.replace(".", "\\.")} \\{([^}]+)\\}`));
  assert.ok(block, `Missing theme: ${theme}`);
  const values = Object.fromEntries(
    [...block[1].matchAll(/--([\w-]+):\s*([^;]+);/g)].map(([, name, value]) => [
      name,
      value.trim(),
    ]),
  );
  const resolve = (name) => {
    assert.ok(values[name], `Missing ${theme} token: ${name}`);
    const alias = /^var\(--([\w-]+)\)$/.exec(values[name]);
    return alias ? values[alias[1]] : values[name];
  };
  for (const token of tokens) luminance(resolve(token));
  for (const [foreground, background, minimum] of pairs) {
    const first = luminance(resolve(foreground));
    const second = luminance(resolve(background));
    const ratio = (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
    const passes = ratio >= minimum;
    failed ||= !passes;
    console.log(
      `${passes ? "PASS" : "FAIL"} ${theme} ${foreground}/${background}: ${ratio.toFixed(2)}:1 (>=${minimum})`,
    );
  }
}
if (failed) process.exitCode = 1;
