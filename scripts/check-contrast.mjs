#!/usr/bin/env node
// Checks WCAG 2 contrast for every colour pair the app renders, in both themes, using the
// theme values in src/index.css. Run with `npm run check:contrast`; CI runs it with lint.
import {readFileSync} from 'node:fs';

const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');

function readBlock(selector) {
  const start = css.indexOf(`${selector} {`);
  if (start === -1) throw new Error(`No ${selector} block in src/index.css`);
  const body = css.slice(start, css.indexOf('\n  }', start));
  return Object.fromEntries(
    [...body.matchAll(/--([a-z0-9-]+):\s*([^;]+);/g)].map(([, name, value]) => [
      name,
      value.trim(),
    ]),
  );
}

const themes = {light: readBlock(':root'), dark: readBlock('.dark')};

function hslToRgb(h, s, l) {
  s /= 100;
  l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)];
}

// Theme values are bare channel lists: `H S% L%` for hsl() tokens, `R G B` for category tokens.
function rgbOf(theme, name) {
  if (name === 'white') return [1, 1, 1];
  const value = themes[theme][name];
  if (value === undefined) throw new Error(`--${name} is not defined in the ${theme} theme`);
  const parts = value.split(/\s+/).map((part) => parseFloat(part));
  return value.includes('%') ? hslToRgb(...parts) : parts.map((channel) => channel / 255);
}

function blend(fg, bg, alpha) {
  return fg.map((channel, i) => channel * alpha + bg[i] * (1 - alpha));
}

function luminance([r, g, b]) {
  const lin = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function ratio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const TEXT = 4.5;
const NON_TEXT = 3;
const grounds = ['background', 'card', 'popover'];
const onGrounds = (fg, min, where) => grounds.map((bg) => ({fg, bg, min, where}));
const statuses = ['destructive', 'warning', 'info', 'success'];
const categories = Object.keys(themes.light).filter((name) => name.startsWith('category-'));

// Pairs both themes render. Each entry: text (or mark) colour, the ground it sits on, minimum.
const shared = [
  ...onGrounds('foreground', TEXT, 'body text'),
  ...onGrounds('muted-foreground', TEXT, 'supporting text'),
  ...onGrounds('primary', TEXT, 'links and accent text'),
  {fg: 'primary-foreground', bg: 'primary', min: TEXT, where: 'primary button'},
  {fg: 'secondary-foreground', bg: 'secondary', min: TEXT, where: 'secondary button'},
  {fg: 'accent-foreground', bg: 'accent', min: TEXT, where: 'hover and on states'},
  {
    fg: 'destructive-foreground',
    bg: 'destructive',
    min: TEXT,
    where: 'destructive button and badge',
  },
  ...onGrounds('destructive', TEXT, 'form errors'),
  ...onGrounds('warning', TEXT, 'warning text'),
  ...onGrounds('success', TEXT, 'positive amounts'),
  ...onGrounds('ring', NON_TEXT, 'focus ring'),
  ...['chart-primary', 'chart-secondary'].map((fg) => ({
    fg,
    bg: 'card',
    min: NON_TEXT,
    where: 'chart marks',
  })),
  ...categories.map((fg) => ({fg, bg: 'background', min: TEXT, where: 'category label'})),
  // Category chips: the icon sits on a 10% tint of its colour over the page.
  ...categories.map((fg) => ({
    fg,
    bg: 'background',
    tint: 0.1,
    min: NON_TEXT,
    where: 'category chip icon',
  })),
];

const pairs = {
  light: [
    ...shared,
    // Light toasts set the status colour on its pale `*-foreground` ground.
    ...statuses.map((s) => ({fg: s, bg: `${s}-foreground`, min: TEXT, where: `${s} toast`})),
  ],
  dark: [
    ...shared,
    // Dark toasts set `foreground` on the dark `*-foreground` ground.
    ...statuses.map((s) => ({
      fg: 'foreground',
      bg: `${s}-foreground`,
      min: TEXT,
      where: `${s} toast`,
    })),
  ],
};

let failures = 0;
for (const [theme, list] of Object.entries(pairs)) {
  for (const {fg, bg, min, where, tint} of list) {
    const fgRgb = rgbOf(theme, fg);
    const bgRgb = tint ? blend(fgRgb, rgbOf(theme, bg), tint) : rgbOf(theme, bg);
    const value = ratio(fgRgb, bgRgb);
    if (value < min) {
      failures += 1;
      const ground = tint ? `${Math.round(tint * 100)}% ${fg} over ${bg}` : bg;
      console.error(
        `✗ ${theme}: ${fg} on ${ground} is ${value.toFixed(2)}:1, needs ${min}:1 (${where})`,
      );
    }
  }
}

const total = pairs.light.length + pairs.dark.length;
if (failures > 0) {
  console.error(`\n${failures} of ${total} colour pairs are below WCAG AA.`);
  process.exit(1);
}
console.log(`All ${total} colour pairs meet WCAG AA in both themes.`);
