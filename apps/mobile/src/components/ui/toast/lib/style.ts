import type { ToastGlass, ToastSemantic, ToastSymbolEffect } from "./types";

/**
 * A color that adapts to light/dark appearance without a React context.
 *
 * Pass one value for a frozen (non-adaptive) color, or supply `dark` to get a
 * value resolved natively against the trait collection — the context-free
 * equivalent of a dynamic system color. Prefer semantic roles (fully adaptive)
 * over frozen overrides where possible.
 */
export type ToastColor = {
  readonly dark: number;
  readonly light: number;
};

/** Wire format for a color pair: `{light: ARGB, dark: ARGB}`. */
type ToastColorWire = { readonly dark: number; readonly light: number };

/**
 * Builds a {@link ToastColor} from hex strings. Accepts `#RRGGBB`, `#AARRGGBB`,
 * or the same without the leading `#` / with a `0x` prefix (case-insensitive). A
 * 6-digit value is treated as fully opaque. Supply `dark` for a distinct
 * dark-mode value; otherwise `light` is reused.
 *
 * ```ts
 * hexColor("#b0afb0");
 * hexColor("#2196F3", "#0D47A1");
 * ```
 */
export function hexColor(light: string, dark?: string): ToastColor {
  const parsedLight = parseHex(light);
  return { dark: dark === undefined ? parsedLight : parseHex(dark), light: parsedLight };
}

/** Builds a {@link ToastColor} from 32-bit ARGB ints. */
export function argbColor(light: number, dark?: number): ToastColor {
  return { dark: dark ?? light, light };
}

function parseHex(input: string): number {
  let hex = input.trim();
  if (hex.startsWith("#")) hex = hex.slice(1);
  if (hex.startsWith("0x") || hex.startsWith("0X")) hex = hex.slice(2);
  if (hex.length === 6) hex = `ff${hex}`;
  const value = hex.length === 8 && /^[0-9a-fA-F]{8}$/.test(hex) ? Number.parseInt(hex, 16) : NaN;
  if (Number.isNaN(value)) {
    throw new Error(`Expected a hex color like "#RRGGBB" or "#AARRGGBB", got "${input}"`);
  }
  return value;
}

/**
 * Per-toast visual override. Every field is null-means-inherit: anything left
 * undefined falls back to the semantic-derived value computed natively (which is
 * where the adaptive Liquid Glass / dark-mode defaults live).
 */
export type ToastStyleOverride = {
  /**
   * Surface color. On iOS 26+ this tints the Liquid Glass (a translucent wash
   * over the live refraction — pass a reduced alpha for subtlety); on the iOS
   * 17–25 frosted tier, under Reduce Transparency, and on Android, it fills the
   * (opaque) surface. Undefined keeps the neutral adaptive default.
   *
   * When set and `foreground` is left undefined, a readable text color
   * (near-black or near-white, per light/dark) is chosen automatically by
   * contrast.
   */
  readonly background?: ToastColor;
  /**
   * Corner radius. Undefined lets native choose (capsule for compact, rounded
   * rect for multi-line).
   */
  readonly cornerRadius?: number;
  /**
   * Title + message color. When undefined and `background` is set, it is derived
   * automatically for contrast; otherwise the native default.
   */
  readonly foreground?: ToastColor;
  /** Glass treatment. Undefined inherits the app-wide default (`adaptive`). */
  readonly glass?: ToastGlass;
  /** Icon color (defaults to `foreground` or `tint` natively). */
  readonly iconColor?: ToastColor;
  /** Animated effect applied to the icon's SF Symbol. */
  readonly symbolEffect?: ToastSymbolEffect;
  /**
   * Accent tint. Colors the icon, spinner, and progress ring — never the
   * surface. Use `background` to color the surface.
   */
  readonly tint?: ToastColor;
};

// Assumed surface base the tint composites over when computing contrast (mirrors
// the neutral opaque fills used natively). Near-, not pure-, B/W text keeps the
// look soft.
const LIGHT_SURFACE_BASE = 0xfffafafa;
const DARK_SURFACE_BASE = 0xff242424;
const ON_LIGHT_TEXT = 0xff1a1a1a;
const ON_DARK_TEXT = 0xfff5f5f5;

/**
 * Serializes a style override to the wire format.
 *
 * `semantic` lets the icon auto-color decision see the toast's intent: a semantic
 * toast keeps its role-colored glyph over a custom surface.
 */
export function styleToWire(
  style: ToastStyleOverride,
  semantic: ToastSemantic,
): Record<string, unknown> {
  const effectiveForeground = style.foreground ?? autoForeground(style.background);
  const effectiveIconColor = style.iconColor ?? autoIconColor(style, semantic);
  const wire: Record<string, unknown> = {};
  if (style.tint) wire.tint = colorToWire(style.tint);
  if (style.background) wire.background = colorToWire(style.background);
  if (effectiveForeground) wire.foreground = colorToWire(effectiveForeground);
  if (effectiveIconColor) wire.iconColor = colorToWire(effectiveIconColor);
  if (style.glass) wire.glass = style.glass;
  if (style.cornerRadius !== undefined) wire.cornerRadius = style.cornerRadius;
  if (style.symbolEffect && style.symbolEffect !== "none") {
    wire.symbolEffect = style.symbolEffect;
  }
  return wire;
}

function colorToWire(color: ToastColor): ToastColorWire {
  return { dark: color.dark, light: color.light };
}

/**
 * A readable text color derived from `background` for contrast, or undefined
 * when there is no (sufficiently opaque) background to derive from.
 */
function autoForeground(background: ToastColor | undefined): ToastColor | undefined {
  if (!background || !isOpaqueEnough(background)) return undefined;
  return {
    dark: onColor(background.dark, DARK_SURFACE_BASE),
    light: onColor(background.light, LIGHT_SURFACE_BASE),
  };
}

/**
 * The icon on-color, only when the icon would otherwise be neutral: no explicit
 * `iconColor`/`tint` and no semantic role to color it. Keeps the glyph readable
 * over a custom surface without overriding a semantic color.
 */
function autoIconColor(style: ToastStyleOverride, semantic: ToastSemantic): ToastColor | undefined {
  if (style.tint) return undefined; // tint already drives the icon
  if (semantic !== "none") return undefined;
  return autoForeground(style.background);
}

function alphaOf(argb: number): number {
  return ((argb >>> 24) & 0xff) / 255;
}

function isOpaqueEnough(color: ToastColor): boolean {
  return alphaOf(color.light) >= 0.5 || alphaOf(color.dark) >= 0.5;
}

/**
 * Picks the near-black or near-white text with the higher WCAG contrast ratio
 * against `bg` (composited over `base` to account for any alpha).
 */
function onColor(bg: number, base: number): number {
  const luminance = relativeLuminance(composite(bg, base));
  const contrastWhite = 1.05 / (luminance + 0.05);
  const contrastBlack = (luminance + 0.05) / 0.05;
  return contrastWhite >= contrastBlack ? ON_DARK_TEXT : ON_LIGHT_TEXT;
}

type Rgb = { readonly b: number; readonly g: number; readonly r: number };

function composite(fg: number, base: number): Rgb {
  const a = alphaOf(fg);
  const channel = (shift: number) => {
    const f = ((fg >>> shift) & 0xff) / 255;
    const b = ((base >>> shift) & 0xff) / 255;
    return f * a + b * (1 - a);
  };
  return { b: channel(0), g: channel(8), r: channel(16) };
}

function relativeLuminance(c: Rgb): number {
  const lin = (x: number) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
}
