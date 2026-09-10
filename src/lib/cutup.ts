export interface Piece {
  id: string;
  text: string;
  x: number; // percent, 0-100, position within the table
  y: number; // percent, 0-100
  rot: number; // degrees
}

const MIN_LINE_CHARS = 22;
const MAX_LINE_CHARS = 40;
const SHORT_LINE_WORD_LIMIT = 3; // lines with this many words or fewer are never cut

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function splitWords(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}

export function makePieceId(): string {
  return `p-${Math.random().toString(36).slice(2, 10)}`;
}

/** Wraps a single long line of text into several shorter lines, breaking only between words. */
function wrapLine(line: string): string[] {
  const words = line.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const wrapped: string[] = [];
  let current = '';
  let targetWidth = randInt(MIN_LINE_CHARS, MAX_LINE_CHARS);

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (current && candidate.length > targetWidth) {
      wrapped.push(current);
      current = word;
      targetWidth = randInt(MIN_LINE_CHARS, MAX_LINE_CHARS);
    } else {
      current = candidate;
    }
  }
  if (current) wrapped.push(current);
  return wrapped;
}

/** Turns raw free text into "physical" lines, respecting the author's own line breaks
 *  and only auto-wrapping runs of text that are too long to have fit on one written line. */
function textToLines(rawText: string): string[] {
  const rawLines = rawText.split('\n').map((l) => l.trim()).filter(Boolean);
  const lines: string[] = [];
  for (const rawLine of rawLines) {
    if (rawLine.length <= MAX_LINE_CHARS) {
      lines.push(rawLine);
    } else {
      lines.push(...wrapLine(rawLine));
    }
  }
  return lines;
}

/** Cuts each line at a random word boundary into two strips, unless the line is very short. */
function cutLinesIntoStrips(lines: string[]): string[] {
  const strips: string[] = [];
  for (const line of lines) {
    const words = splitWords(line);
    if (words.length <= SHORT_LINE_WORD_LIMIT) {
      strips.push(line);
      continue;
    }
    const cutIndex = randInt(1, words.length - 1); // both sides get at least one word
    strips.push(words.slice(0, cutIndex).join(' '));
    strips.push(words.slice(cutIndex).join(' '));
  }
  return strips;
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Scatters pieces messily across the table using a jittered grid, so strips overlap a little
 *  but stay mostly graspable rather than piling in one spot. */
function layoutPieces(strips: string[]): Piece[] {
  const shuffled = shuffle(strips);
  const count = shuffled.length;
  const cols = Math.max(1, Math.ceil(Math.sqrt(count * 1.4)));
  const rows = Math.max(1, Math.ceil(count / cols));
  const cellW = 100 / cols;
  const cellH = 100 / rows;

  return shuffled.map((text, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const jitterX = (Math.random() - 0.5) * cellW * 0.7;
    const jitterY = (Math.random() - 0.5) * cellH * 0.7;
    const x = Math.min(94, Math.max(4, col * cellW + cellW / 2 + jitterX));
    const y = Math.min(94, Math.max(4, row * cellH + cellH / 2 + jitterY));
    return {
      id: makePieceId(),
      text,
      x,
      y,
      rot: (Math.random() - 0.5) * 24,
    };
  });
}

export function generatePieces(rawText: string): Piece[] {
  const lines = textToLines(rawText);
  const strips = cutLinesIntoStrips(lines);
  return layoutPieces(strips);
}
