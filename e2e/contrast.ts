/**
 * Minimal colour maths for the visual audit. Browser computed styles are
 * OKLCH (design tokens), so convert them to sRGB before measuring contrast.
 */

type RGB = [number, number, number]; // 0..1 sRGB
type RGBA = [number, number, number, number];

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function parseAlpha(raw: string | undefined): number {
  if (!raw) return 1;
  const value = raw.trim();
  if (value.endsWith('%')) return clamp01(Number.parseFloat(value) / 100);
  return clamp01(Number.parseFloat(value));
}

function oklchToRgb(l: number, c: number, h: number): RGB {
  const rad = (h * Math.PI) / 180;
  const a = c * Math.cos(rad);
  const b = c * Math.sin(rad);

  const lPrime = l + 0.3963377774 * a + 0.2158037573 * b;
  const mPrime = l - 0.1055613458 * a - 0.0638541728 * b;
  const sPrime = l - 0.0894841775 * a - 1.291485548 * b;

  const ll = lPrime ** 3;
  const mm = mPrime ** 3;
  const ss = sPrime ** 3;

  const r = 4.0767416621 * ll - 3.3077115913 * mm + 0.2309699292 * ss;
  const g = -1.2684380046 * ll + 2.6097574011 * mm - 0.3413193965 * ss;
  const bl = -0.0041960863 * ll - 0.7034186147 * mm + 1.707614701 * ss;

  // OKLab yields linear-light sRGB; CSS computed colours are gamma-encoded.
  const encode = (channel: number) => {
    const c = clamp01(channel);
    return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
  };

  return [encode(r), encode(g), encode(bl)];
}

export function parseColor(input: string): RGBA | null {
  const value = input.trim().toLowerCase();
  if (!value || value === 'transparent' || value === 'none') return [0, 0, 0, 0];

  const rgbMatch = value.match(/^rgba?\(([^)]+)\)$/);
  if (rgbMatch) {
    const parts = rgbMatch[1].split(/[\s,/]+/).filter(Boolean);
    if (parts.length >= 3) {
      return [
        clamp01(Number.parseFloat(parts[0]) / 255),
        clamp01(Number.parseFloat(parts[1]) / 255),
        clamp01(Number.parseFloat(parts[2]) / 255),
        parseAlpha(parts[3]),
      ];
    }
  }

  const oklchMatch = value.match(/^oklch\(([^)]+)\)$/);
  if (oklchMatch) {
    const [main, alpha] = oklchMatch[1].split('/');
    const parts = main.trim().split(/\s+/);
    if (parts.length >= 3) {
      const lRaw = parts[0].endsWith('%') ? Number.parseFloat(parts[0]) / 100 : Number.parseFloat(parts[0]);
      const cRaw = parts[1].endsWith('%') ? Number.parseFloat(parts[1]) / 100 : Number.parseFloat(parts[1]);
      const [r, g, b] = oklchToRgb(clamp01(lRaw), Math.max(0, cRaw), Number.parseFloat(parts[2]));
      return [r, g, b, parseAlpha(alpha)];
    }
  }

  const srgbMatch = value.match(/^color\(srgb\s+([^)]+)\)$/);
  if (srgbMatch) {
    const [main, alpha] = srgbMatch[1].split('/');
    const parts = main.trim().split(/\s+/);
    if (parts.length >= 3) {
      return [
        clamp01(Number.parseFloat(parts[0])),
        clamp01(Number.parseFloat(parts[1])),
        clamp01(Number.parseFloat(parts[2])),
        parseAlpha(alpha),
      ];
    }
  }

  return null;
}

function composite(top: RGBA, bottom: RGB): RGB {
  const a = top[3];
  return [
    top[0] * a + bottom[0] * (1 - a),
    top[1] * a + bottom[1] * (1 - a),
    top[2] * a + bottom[2] * (1 - a),
  ];
}

function relativeLuminance([r, g, b]: RGB): number {
  const lin = (channel: number) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export interface TextPair {
  text: string;
  color: string;
  backgrounds: string[];
  fontSize: number;
  fontWeight: number;
  opacity: number;
  selector: string;
}

export interface ContrastResult {
  ratio: number;
  text: string;
  selector: string;
  foreground: string;
  background: string;
  fontSize: number;
}

export function measureContrast(pair: TextPair): ContrastResult | null {
  const foreground = parseColor(pair.color);
  const layers = pair.backgrounds.map(parseColor);
  if (!foreground || layers.some((layer) => !layer)) return null;
  if (pair.opacity < 0.9) return null;

  // Paint from the farthest ancestor to the nearest one.
  let background: RGB = [1, 1, 1];
  for (const layer of [...layers].reverse()) {
    background = composite(layer as RGBA, background);
  }

  const text = composite([foreground[0], foreground[1], foreground[2], foreground[3] * pair.opacity], background);
  const fgLum = relativeLuminance(text);
  const bgLum = relativeLuminance(background);
  const ratio = (Math.max(fgLum, bgLum) + 0.05) / (Math.min(fgLum, bgLum) + 0.05);

  return {
    ratio,
    text: pair.text,
    selector: pair.selector,
    foreground: pair.color,
    background: pair.backgrounds[0] ?? 'unknown',
    fontSize: pair.fontSize,
  };
}
