/* Colores de marca para la página pública. Un solo mapa para el panel y la reserva. */
import type { ThemeId } from "./store";

export const THEME_OPTIONS: { id: ThemeId; name: string; color: string }[] = [
  { id: "evergreen", name: "Bosque", color: "#16845f" },
  { id: "midnight", name: "Zafiro", color: "#0369a1" },
  { id: "coral", name: "Terracota", color: "#c2410c" },
  { id: "rose", name: "Frambuesa", color: "#be185d" },
  { id: "obsidian", name: "Ámbar", color: "#b45309" },
  { id: "ocean", name: "Esmeralda", color: "#047857" },
];

export const BRAND_SWATCHES = ["#16845f", "#245442", "#0369a1", "#1e3a8a", "#6d28d9", "#be185d", "#9f1239", "#c2410c", "#b45309", "#334155"];

export function themeAccent(s: { theme?: ThemeId; brandColor?: string }): string {
  if (s.brandColor && /^#[0-9a-f]{6}$/i.test(s.brandColor)) return s.brandColor;
  return THEME_OPTIONS.find((t) => t.id === s.theme)?.color || "#16845f";
}

/** Blanco o casi negro según el contraste con el color de fondo. */
export function contrastText(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return "#fff";
  const n = parseInt(m[1], 16);
  const lin = (c: number) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const L = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  return L > 0.42 ? "#111814" : "#ffffff";
}
