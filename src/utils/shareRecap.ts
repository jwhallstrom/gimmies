/**
 * Shareable Round Recap Image Generator
 *
 * Renders the recap data onto an offscreen Canvas as a branded card image.
 * Uses the Web Share API on mobile (share as image) or downloads a PNG on desktop.
 * Zero external dependencies — pure Canvas 2D.
 */

import type { RoundRecap, RoundRecapHighlight } from './roundRecap';

// ── Design tokens ────────────────────────────────────────────────────────────
const CARD_WIDTH = 600;
const PADDING = 28;
const LINE_HEIGHT = 22;
const SECTION_GAP = 16;

const COLORS = {
  headerBg: '#1a6b3c',        // primary-700-ish
  headerBgEnd: '#0f4d2a',     // primary-900-ish
  white: '#ffffff',
  dimWhite: '#d4e7dc',
  cardBg: '#fafbfc',
  text: '#1e293b',
  textMuted: '#64748b',
  sectionLabel: '#94a3b8',
  border: '#e2e8f0',
  accent: '#059669',
};

const CATEGORY_LABELS: Record<string, string> = {
  scoring: 'SCORING',
  highlights: 'HIGHLIGHTS',
  analysis: 'COURSE ANALYSIS',
  money: 'MONEY',
};

const CATEGORY_ORDER = ['scoring', 'highlights', 'analysis', 'money'];

// ── Canvas helpers ───────────────────────────────────────────────────────────

/** Draw rounded rect */
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/** Word-wrap text, returning lines */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';

  words.forEach((word) => {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = test;
    }
  });
  if (current) lines.push(current);
  return lines;
}

// ── Main renderer ────────────────────────────────────────────────────────────

/**
 * Render the recap to a canvas and return a Blob (PNG).
 */
export async function renderRecapImage(recap: RoundRecap): Promise<Blob> {
  // Group highlights by category
  const grouped = CATEGORY_ORDER
    .map((cat) => ({
      category: cat,
      label: CATEGORY_LABELS[cat] || cat.toUpperCase(),
      items: recap.highlights.filter((h) => h.category === cat),
    }))
    .filter((g) => g.items.length > 0);

  // ── Pass 1: measure height ──────────────────────────────
  const measure = document.createElement('canvas').getContext('2d')!;
  measure.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

  const contentWidth = CARD_WIDTH - PADDING * 2;
  let totalHeight = 0;

  // Header
  const headerH = 72;
  totalHeight += headerH;

  // Content padding top
  totalHeight += PADDING;

  grouped.forEach((group, gi) => {
    if (gi > 0) totalHeight += SECTION_GAP;
    totalHeight += 20; // section label

    group.items.forEach((h) => {
      totalHeight += 8; // gap before item
      // emoji + title line
      totalHeight += LINE_HEIGHT;
      // description (may wrap)
      measure.font = '13px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      const descLines = wrapText(measure, h.description, contentWidth - 40);
      totalHeight += descLines.length * 18;
      totalHeight += 8; // bottom pad of item
    });
  });

  // Footer
  totalHeight += 20; // gap
  totalHeight += 24; // branding line
  totalHeight += PADDING; // bottom pad

  // ── Pass 2: draw ────────────────────────────────────────
  const dpr = 2; // retina
  const canvas = document.createElement('canvas');
  canvas.width = CARD_WIDTH * dpr;
  canvas.height = totalHeight * dpr;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(dpr, dpr);

  // Background
  roundRect(ctx, 0, 0, CARD_WIDTH, totalHeight, 16);
  ctx.fillStyle = COLORS.cardBg;
  ctx.fill();
  ctx.strokeStyle = COLORS.border;
  ctx.lineWidth = 1;
  ctx.stroke();

  // Header gradient
  ctx.save();
  roundRect(ctx, 0, 0, CARD_WIDTH, headerH, 16);
  // Clip bottom corners to be square
  ctx.rect(0, headerH - 16, CARD_WIDTH, 16);
  ctx.clip('evenodd');
  const grad = ctx.createLinearGradient(0, 0, CARD_WIDTH, 0);
  grad.addColorStop(0, COLORS.headerBg);
  grad.addColorStop(1, COLORS.headerBgEnd);
  roundRect(ctx, 0, 0, CARD_WIDTH, headerH, 16);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.restore();

  // Header text
  ctx.fillStyle = COLORS.white;
  ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.fillText('🏁  Round Recap', PADDING, 34);

  ctx.fillStyle = COLORS.dimWhite;
  ctx.font = '13px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  const subtitle = [
    recap.courseName,
    new Date(recap.date).toLocaleDateString(),
    recap.coursePar ? `Par ${recap.coursePar}` : '',
  ]
    .filter(Boolean)
    .join(' · ');
  ctx.fillText(subtitle, PADDING, 56);

  // Highlights
  let y = headerH + PADDING;

  grouped.forEach((group, gi) => {
    if (gi > 0) y += SECTION_GAP;

    // Section label
    ctx.fillStyle = COLORS.sectionLabel;
    ctx.font = 'bold 10px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillText(group.label, PADDING, y + 10);
    y += 20;

    group.items.forEach((h) => {
      y += 8;

      // Emoji + title
      ctx.font = '16px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      ctx.fillStyle = COLORS.text;
      ctx.fillText(h.emoji, PADDING, y + LINE_HEIGHT - 4);

      ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      ctx.fillStyle = COLORS.text;
      ctx.fillText(h.title, PADDING + 30, y + LINE_HEIGHT - 4);
      y += LINE_HEIGHT;

      // Description (wrapped)
      ctx.font = '13px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      ctx.fillStyle = COLORS.textMuted;
      const lines = wrapText(ctx, h.description, contentWidth - 40);
      lines.forEach((line) => {
        ctx.fillText(line, PADDING + 30, y + 14);
        y += 18;
      });

      y += 8;

      // Separator line
      ctx.strokeStyle = COLORS.border;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(PADDING + 30, y);
      ctx.lineTo(CARD_WIDTH - PADDING, y);
      ctx.stroke();
    });
  });

  // Footer branding
  y += 20;
  ctx.fillStyle = COLORS.accent;
  ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.fillText('⛳ Gimmies Golf', PADDING, y + 12);

  ctx.fillStyle = COLORS.sectionLabel;
  ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.fillText('golfwithgimmies.com', CARD_WIDTH - PADDING - ctx.measureText('golfwithgimmies.com').width, y + 12);

  // Convert to blob
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Canvas toBlob failed'))),
      'image/png'
    );
  });
}

// ── Share / Download ─────────────────────────────────────────────────────────

/**
 * Share or download the recap image.
 * On mobile (Web Share API): opens the native share sheet with the image.
 * On desktop: triggers a PNG download.
 */
export async function shareRecapImage(recap: RoundRecap): Promise<void> {
  const blob = await renderRecapImage(recap);
  const file = new File([blob], `recap-${recap.date}.png`, { type: 'image/png' });

  // Try native share (mobile)
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({
        title: `${recap.eventName} — Round Recap`,
        text: recap.summary,
        files: [file],
      });
      return;
    } catch (err: any) {
      if (err?.name === 'AbortError') return; // user cancelled
    }
  }

  // Fallback: download
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `recap-${recap.date}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
