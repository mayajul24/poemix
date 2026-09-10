import { useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import { makePieceId, readingOrderText, splitWords, type Piece } from '../lib/cutup';
import { downloadBlob, downloadText, renderPiecesToPngBlob } from '../lib/exportImage';
import { Strip } from './Strip';

interface CutupBoardProps {
  initialPieces: Piece[];
  originalText: string;
  onNewText: () => void;
  onEditOriginal: () => void;
  onReshuffle: () => void;
}

const TAP_THRESHOLD = 8; // px of movement below which a pointer gesture counts as a tap, not a drag
const MERGE_THRESHOLD = 22; // px gap below which a dropped piece glues to its neighbor
const BG_PRESETS = ['#3a2e26', '#1f3a2e', '#1f2a3a', '#3a1f2e', '#2a2a2a', '#3a3524'];
const BG_STORAGE_KEY = 'poemix-bg-color';

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** 0 if the two rects touch or overlap, otherwise the gap between them. */
function rectDistance(a: DOMRect, b: DOMRect): number {
  const dx = Math.max(b.left - a.right, a.left - b.right, 0);
  const dy = Math.max(b.top - a.bottom, a.top - b.bottom, 0);
  return Math.hypot(dx, dy);
}

function loadBgColor(): string {
  try {
    return localStorage.getItem(BG_STORAGE_KEY) || BG_PRESETS[0];
  } catch {
    return BG_PRESETS[0];
  }
}

export function CutupBoard({
  initialPieces,
  originalText,
  onNewText,
  onEditOriginal,
  onReshuffle,
}: CutupBoardProps) {
  const [tablePieces, setTablePieces] = useState<Piece[]>(initialPieces);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [cuttingId, setCuttingId] = useState<string | null>(null);
  const [gluedId, setGluedId] = useState<string | null>(null);
  const [bgColor, setBgColorState] = useState<string>(loadBgColor);
  const [showOriginal, setShowOriginal] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showSaveMenu, setShowSaveMenu] = useState(false);
  const [copied, setCopied] = useState(false);

  const tableRef = useRef<HTMLDivElement>(null);

  const setBgColor = (color: string) => {
    setBgColorState(color);
    try {
      localStorage.setItem(BG_STORAGE_KEY, color);
    } catch {
      // private mode / storage disabled - the color just won't persist
    }
  };

  const mergePieces = (idA: string, idB: string, rectA: DOMRect, rectB: DOMRect) => {
    const mergedId = makePieceId();
    setTablePieces((prev) => {
      const a = prev.find((p) => p.id === idA);
      const b = prev.find((p) => p.id === idB);
      const tableRect = tableRef.current?.getBoundingClientRect();
      if (!a || !b || !tableRect) return prev;

      const centerAX = rectA.left + rectA.width / 2;
      const centerAY = rectA.top + rectA.height / 2;
      const centerBX = rectB.left + rectB.width / 2;
      const centerBY = rectB.top + rectB.height / 2;
      const dx = centerAX - centerBX;
      const dy = centerAY - centerBY;

      // side by side -> reading right-to-left, rightmost piece comes first;
      // stacked -> the higher piece comes first
      const sideBySide = Math.abs(dx) >= Math.abs(dy);
      const aFirst = sideBySide ? dx > 0 : dy < 0;
      const text = aFirst ? `${a.text} ${b.text}` : `${b.text} ${a.text}`;

      // keep the (now wider) merged piece from hanging off the table edge, where
      // it would get clipped by the table's overflow:hidden
      const estWidthPx = sideBySide
        ? rectA.width + rectB.width + 16
        : Math.max(rectA.width, rectB.width);
      const halfWidthPct = (estWidthPx / 2 / tableRect.width) * 100;
      const minX = Math.min(48, 4 + halfWidthPct);
      const maxX = Math.max(52, 96 - halfWidthPct);

      const midX = clamp(
        ((centerAX + centerBX) / 2 - tableRect.left) / tableRect.width * 100,
        minX,
        maxX,
      );
      const midY = clamp(
        ((centerAY + centerBY) / 2 - tableRect.top) / tableRect.height * 100,
        6,
        94,
      );

      const merged: Piece = { id: mergedId, text, x: midX, y: midY, rot: 0 };
      return [...prev.filter((p) => p.id !== idA && p.id !== idB), merged];
    });

    setGluedId(mergedId);
    setTimeout(() => setGluedId((cur) => (cur === mergedId ? null : cur)), 500);
  };

  const startTableDrag = (piece: Piece) => (e: ReactPointerEvent) => {
    const target = e.currentTarget as HTMLElement;
    try {
      target.setPointerCapture(e.pointerId);
    } catch {
      // capture is a nice-to-have; the window-level listeners below still drive the drag
    }

    if (cuttingId && cuttingId !== piece.id) setCuttingId(null);

    const tableRect = tableRef.current?.getBoundingClientRect() ?? null;
    if (!tableRect) return;

    const startClientX = e.clientX;
    const startClientY = e.clientY;
    const startX = piece.x;
    const startY = piece.y;
    setDraggingId(piece.id);

    const handleMove = (ev: PointerEvent) => {
      const dxPct = ((ev.clientX - startClientX) / tableRect.width) * 100;
      const dyPct = ((ev.clientY - startClientY) / tableRect.height) * 100;
      const nx = clamp(startX + dxPct, 2, 98);
      const ny = clamp(startY + dyPct, 2, 98);
      setTablePieces((prev) => prev.map((p) => (p.id === piece.id ? { ...p, x: nx, y: ny } : p)));
    };

    const handleUp = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      setDraggingId(null);

      const moved = Math.hypot(ev.clientX - startClientX, ev.clientY - startClientY);
      if (moved < TAP_THRESHOLD) {
        if (splitWords(piece.text).length > 1) setCuttingId(piece.id);
        return;
      }

      if (!tableRef.current) return;
      const draggedRect = target.getBoundingClientRect();
      const others = Array.from(
        tableRef.current.querySelectorAll<HTMLElement>('[data-piece-id]'),
      ).filter((el) => el.dataset.pieceId !== piece.id);

      let closest: { id: string; rect: DOMRect; dist: number } | null = null;
      for (const el of others) {
        const rect = el.getBoundingClientRect();
        const dist = rectDistance(draggedRect, rect);
        if (dist <= MERGE_THRESHOLD && (!closest || dist < closest.dist)) {
          closest = { id: el.dataset.pieceId as string, rect, dist };
        }
      }

      if (closest) {
        mergePieces(piece.id, closest.id, draggedRect, closest.rect);
      }
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  };

  const cutTablePiece = (id: string, splitIndex: number) => {
    setTablePieces((prev) => {
      const idx = prev.findIndex((p) => p.id === id);
      if (idx === -1) return prev;
      const piece = prev[idx];
      const words = splitWords(piece.text);
      const pieceA: Piece = {
        id: makePieceId(),
        text: words.slice(0, splitIndex).join(' '),
        x: clamp(piece.x - 3, 3, 97),
        y: clamp(piece.y - 2, 3, 97),
        rot: (Math.random() - 0.5) * 24,
      };
      const pieceB: Piece = {
        id: makePieceId(),
        text: words.slice(splitIndex).join(' '),
        x: clamp(piece.x + 3, 3, 97),
        y: clamp(piece.y + 2, 3, 97),
        rot: (Math.random() - 0.5) * 24,
      };
      const next = [...prev];
      next.splice(idx, 1, pieceA, pieceB);
      return next;
    });
    setCuttingId(null);
  };

  const handleCopyText = async () => {
    const text = readingOrderText(tablePieces);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard API unavailable; ignore silently
    }
  };

  const handleDownloadText = () => {
    downloadText(readingOrderText(tablePieces), 'שיר.txt');
    setShowSaveMenu(false);
  };

  const handleDownloadImage = async () => {
    if (!tableRef.current) return;
    const rect = tableRef.current.getBoundingClientRect();
    const blob = await renderPiecesToPngBlob(tablePieces, {
      bgColor,
      width: rect.width,
      height: rect.height,
    });
    downloadBlob(blob, 'שיר.png');
    setShowSaveMenu(false);
  };

  const closePopovers = () => {
    setShowColorPicker(false);
    setShowSaveMenu(false);
  };

  return (
    <div className="screen board-screen" style={{ '--wood-light': bgColor } as CSSProperties}>
      <header className="board-header">
        <button type="button" className="btn btn--ghost btn--small" onClick={onNewText}>
          טקסט חדש
        </button>
        <button type="button" className="btn btn--ghost btn--small" onClick={onReshuffle}>
          גזירה מחדש
        </button>
        <button
          type="button"
          className="btn btn--ghost btn--icon"
          aria-label="הטקסט המקורי"
          onClick={() => {
            closePopovers();
            setShowOriginal(true);
          }}
        >
          📄
        </button>
        <div className="popover-anchor">
          <button
            type="button"
            className="btn btn--ghost btn--icon"
            aria-label="צבע רקע"
            onClick={() => {
              setShowSaveMenu(false);
              setShowColorPicker((v) => !v);
            }}
          >
            🎨
          </button>
          {showColorPicker && (
            <div className="popover color-popover">
              {BG_PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className="swatch"
                  style={{ background: c }}
                  aria-label={c}
                  onClick={() => {
                    setBgColor(c);
                    setShowColorPicker(false);
                  }}
                />
              ))}
              <label className="swatch swatch--custom">
                🎨
                <input
                  type="color"
                  value={bgColor}
                  onChange={(e) => setBgColor(e.target.value)}
                />
              </label>
            </div>
          )}
        </div>
        <div className="popover-anchor">
          <button
            type="button"
            className="btn btn--ghost btn--icon"
            aria-label="שמירה"
            onClick={() => {
              setShowColorPicker(false);
              setShowSaveMenu((v) => !v);
            }}
          >
            💾
          </button>
          {showSaveMenu && (
            <div className="popover save-popover">
              <button type="button" onClick={handleCopyText}>
                {copied ? 'הועתק ✓' : 'העתיקי טקסט'}
              </button>
              <button type="button" onClick={handleDownloadText}>
                הורידי כטקסט
              </button>
              <button type="button" onClick={handleDownloadImage}>
                הורידי כתמונה
              </button>
            </div>
          )}
        </div>
      </header>

      <div
        className="table"
        ref={tableRef}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            if (cuttingId) setCuttingId(null);
            closePopovers();
          }
        }}
      >
        {tablePieces.length === 0 && (
          <p className="table-hint">כל השורות נגזרו... לחצי &quot;גזירה מחדש&quot; כדי לפזר שוב</p>
        )}
        {tablePieces.map((piece, i) => {
          const isCutting = cuttingId === piece.id;
          return (
            <Strip
              key={piece.id}
              pieceId={piece.id}
              text={piece.text}
              dragging={draggingId === piece.id}
              cutting={isCutting}
              words={isCutting ? splitWords(piece.text) : undefined}
              onCut={(splitIndex) => cutTablePiece(piece.id, splitIndex)}
              onCancelCut={() => setCuttingId(null)}
              onPointerDown={isCutting ? undefined : startTableDrag(piece)}
              className={gluedId === piece.id ? 'strip--glued' : ''}
              style={{
                position: 'absolute',
                left: isCutting ? '50%' : `${piece.x}%`,
                top: isCutting ? '46%' : `${piece.y}%`,
                transform: `translate(-50%, -50%) rotate(${isCutting ? 0 : piece.rot}deg)`,
                zIndex: draggingId === piece.id || isCutting || gluedId === piece.id ? 50 : 1,
                animationDelay: `${Math.min(i, 20) * 25}ms`,
              }}
            />
          );
        })}
      </div>

      {showOriginal && (
        <div className="modal-overlay" onClick={() => setShowOriginal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h2>הטקסט המקורי</h2>
              <button
                type="button"
                className="modal-close"
                aria-label="סגירה"
                onClick={() => setShowOriginal(false)}
              >
                ×
              </button>
            </div>
            <pre className="modal-text" dir="auto">
              {originalText}
            </pre>
            <div className="modal-actions">
              <button type="button" className="btn btn--ghost btn--small" onClick={onEditOriginal}>
                ערכי טקסט
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
