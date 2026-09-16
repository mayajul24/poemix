import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import { ROW_HEIGHT_PX, makePieceId, readingOrderText, splitWords, type Piece } from '../lib/cutup';
import {
  downloadBlob,
  downloadText,
  renderPiecesToPngBlob,
  renderPoemListToPngBlob,
} from '../lib/exportImage';
import { Strip } from './Strip';

interface PoemItem {
  id: string;
  text: string;
}

interface CutupBoardProps {
  initialPieces: Piece[];
  rows: number;
  originalText: string;
  onNewText: () => void;
  onEditOriginal: () => void;
  onReshuffle: () => void;
}

const TAP_THRESHOLD = 8; // px of movement below which a pointer gesture counts as a tap, not a drag
const MIN_TABLE_HEIGHT = 480; // keeps a short scatter from looking like a sliver
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2.5;
const ZOOM_STEP = 0.15;
const WHEEL_ZOOM_SENSITIVITY = 0.0015;
const BG_PRESETS = ['#3a2e26', '#1f3a2e', '#1f2a3a', '#3a1f2e', '#2a2a2a', '#3a3524'];
const BG_STORAGE_KEY = 'poemix-bg-color';

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function isPointInRect(x: number, y: number, rect: DOMRect | null): boolean {
  if (!rect) return false;
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
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
  rows,
  originalText,
  onNewText,
  onEditOriginal,
  onReshuffle,
}: CutupBoardProps) {
  const [tablePieces, setTablePieces] = useState<Piece[]>(initialPieces);
  const [poemPieces, setPoemPieces] = useState<PoemItem[]>([]);
  const [poemOpen, setPoemOpen] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [poemHover, setPoemHover] = useState(false);
  const [cuttingId, setCuttingId] = useState<string | null>(null);
  const [bgColor, setBgColorState] = useState<string>(loadBgColor);
  const [showOriginal, setShowOriginal] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showSaveMenu, setShowSaveMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  const [zoom, setZoom] = useState(1);

  // this is the tall scrollable content div, not the viewport-sized clipper around it -
  // piece x/y percentages resolve against it, and getBoundingClientRect() on it already
  // accounts for however far the table is currently scrolled
  const tableRef = useRef<HTMLDivElement>(null);
  // the viewport-sized clipper itself - the wheel listener needs this one, not
  // tableRef: zoomed out, table-content shrinks well below it, and a listener on
  // the shrinking element stops receiving events once the cursor is over the now-
  // empty space around it (that's the "zoom gets stuck" bug)
  const tableViewportRef = useRef<HTMLDivElement>(null);
  const contentHeight = Math.max(rows * ROW_HEIGHT_PX, MIN_TABLE_HEIGHT);

  // covers the poem drawer whether collapsed (just the handle) or open (the full
  // sheet) - used both as the drag-and-drop target and, when open, to measure sibling
  // rows for reordering
  const poemDropRef = useRef<HTMLDivElement>(null);
  const poemListRef = useRef<HTMLDivElement>(null);

  // only the pieces present at the initial scatter get the entrance "pop in" animation;
  // pieces created afterward by cutting should appear in place immediately, not fade
  // in from invisible (that read as the piece flashing away and back)
  const [initialIds] = useState(() => new Set(initialPieces.map((p) => p.id)));

  const setBgColor = (color: string) => {
    setBgColorState(color);
    try {
      localStorage.setItem(BG_STORAGE_KEY, color);
    } catch {
      // private mode / storage disabled - the color just won't persist
    }
  };

  // plain mouse wheel zooms the table (no modifier key needed) - scrolling to pan
  // is still there via touch drag or the scrollbar itself. React's onWheel is
  // passive, so preventDefault() there is silently ignored - needs a real DOM listener.
  // Attached to the viewport clipper, not the content div it resizes: zoomed out,
  // the content shrinks well below the viewport, and a listener on the shrinking
  // element stops receiving events once the cursor is over the empty space that
  // opens up around it - that was the "zoom gets stuck when zooming out" bug.
  useEffect(() => {
    const el = tableViewportRef.current;
    if (!el) return;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      setZoom((z) => clamp(z - e.deltaY * WHEEL_ZOOM_SENSITIVITY, MIN_ZOOM, MAX_ZOOM));
    };
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, []);

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
      const ny = clamp(startY + dyPct, 1, 99);
      setTablePieces((prev) => prev.map((p) => (p.id === piece.id ? { ...p, x: nx, y: ny } : p)));

      const poemRect = poemDropRef.current?.getBoundingClientRect() ?? null;
      setPoemHover(isPointInRect(ev.clientX, ev.clientY, poemRect));
    };

    const handleUp = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      setDraggingId(null);
      setPoemHover(false);

      const moved = Math.hypot(ev.clientX - startClientX, ev.clientY - startClientY);
      if (moved < TAP_THRESHOLD) {
        if (splitWords(piece.text).length > 1) setCuttingId(piece.id);
        return;
      }

      const poemRect = poemDropRef.current?.getBoundingClientRect() ?? null;
      if (isPointInRect(ev.clientX, ev.clientY, poemRect)) {
        setTablePieces((prev) => prev.filter((p) => p.id !== piece.id));
        setPoemPieces((prev) => [...prev, { id: piece.id, text: piece.text }]);
      }
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  };

  const startPoemDrag = (item: PoemItem) => (e: ReactPointerEvent) => {
    const target = e.currentTarget as HTMLElement;
    try {
      target.setPointerCapture(e.pointerId);
    } catch {
      // capture is a nice-to-have; the window-level listeners below still drive the drag
    }

    if (cuttingId && cuttingId !== item.id) setCuttingId(null);

    const poemRect = poemDropRef.current?.getBoundingClientRect() ?? null;
    const tableRect = tableRef.current?.getBoundingClientRect() ?? null;
    const startClientX = e.clientX;
    const startClientY = e.clientY;
    setDraggingId(item.id);

    const handleMove = (ev: PointerEvent) => {
      const listEl = poemListRef.current;
      if (!listEl) return;
      const rowEls = Array.from(listEl.querySelectorAll<HTMLElement>('[data-poem-id]'));
      const others = rowEls.filter((r) => r.dataset.poemId !== item.id);
      let idx = 0;
      for (const r of others) {
        const rect = r.getBoundingClientRect();
        const mid = rect.top + rect.height / 2;
        if (ev.clientY > mid) idx++;
      }
      setPoemPieces((prev) => {
        const dragged = prev.find((p) => p.id === item.id);
        if (!dragged) return prev;
        const rest = prev.filter((p) => p.id !== item.id);
        rest.splice(idx, 0, dragged);
        return rest;
      });
    };

    const handleUp = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      setDraggingId(null);

      const moved = Math.hypot(ev.clientX - startClientX, ev.clientY - startClientY);
      if (moved < TAP_THRESHOLD) {
        if (splitWords(item.text).length > 1) setCuttingId(item.id);
        return;
      }

      const stillInPoem = isPointInRect(ev.clientX, ev.clientY, poemRect);
      if (!stillInPoem && tableRect) {
        setPoemPieces((prev) => prev.filter((p) => p.id !== item.id));
        const nx = clamp(((ev.clientX - tableRect.left) / tableRect.width) * 100, 2, 98);
        const ny = clamp(((ev.clientY - tableRect.top) / tableRect.height) * 100, 2, 98);
        setTablePieces((prev) => [...prev, { id: item.id, text: item.text, x: nx, y: ny }]);
      }
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  };

  const removeFromPoem = (id: string) => {
    const item = poemPieces.find((p) => p.id === id);
    if (!item) return;
    setPoemPieces((prev) => prev.filter((p) => p.id !== id));
    setTablePieces((prev) => [
      ...prev,
      { id: item.id, text: item.text, x: 50 + (Math.random() - 0.5) * 20, y: 6 },
    ]);
  };

  const cutPiece = (id: string, splitIndex: number) => {
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
      };
      const pieceB: Piece = {
        id: makePieceId(),
        text: words.slice(splitIndex).join(' '),
        x: clamp(piece.x + 3, 3, 97),
        y: clamp(piece.y + 2, 3, 97),
      };
      const next = [...prev];
      next.splice(idx, 1, pieceA, pieceB);
      return next;
    });
    setPoemPieces((prev) => {
      const idx = prev.findIndex((p) => p.id === id);
      if (idx === -1) return prev;
      const words = splitWords(prev[idx].text);
      const next = [...prev];
      next.splice(
        idx,
        1,
        { id: makePieceId(), text: words.slice(0, splitIndex).join(' ') },
        { id: makePieceId(), text: words.slice(splitIndex).join(' ') },
      );
      return next;
    });
    setCuttingId(null);
  };

  const handleCopyText = async () => {
    const text =
      poemPieces.length > 0 ? poemPieces.map((p) => p.text).join('\n') : readingOrderText(tablePieces);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard API unavailable; ignore silently
    }
  };

  const handleDownloadText = () => {
    const text =
      poemPieces.length > 0 ? poemPieces.map((p) => p.text).join('\n') : readingOrderText(tablePieces);
    downloadText(text, 'שיר.txt');
    setShowSaveMenu(false);
  };

  const handleDownloadImage = async () => {
    if (poemPieces.length > 0) {
      const width = tableRef.current?.getBoundingClientRect().width ?? 360;
      const blob = await renderPoemListToPngBlob(
        poemPieces.map((p) => p.text),
        { bgColor, width },
      );
      downloadBlob(blob, 'שיר.png');
    } else {
      if (!tableRef.current) return;
      const rect = tableRef.current.getBoundingClientRect();
      const blob = await renderPiecesToPngBlob(tablePieces, {
        bgColor,
        width: rect.width,
        height: rect.height,
      });
      downloadBlob(blob, 'שיר.png');
    }
    setShowSaveMenu(false);
  };

  const closePopovers = () => {
    setShowColorPicker(false);
    setShowSaveMenu(false);
  };

  const cuttingPiece =
    (cuttingId && tablePieces.find((p) => p.id === cuttingId)) ||
    (cuttingId && poemPieces.find((p) => p.id === cuttingId)) ||
    undefined;

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
        <button
          type="button"
          className="btn btn--ghost btn--icon"
          aria-label="הגדלה"
          disabled={zoom >= MAX_ZOOM}
          onClick={() => setZoom((z) => clamp(z + ZOOM_STEP, MIN_ZOOM, MAX_ZOOM))}
        >
          +
        </button>
        <button
          type="button"
          className="btn btn--ghost btn--icon"
          aria-label="הקטנה"
          disabled={zoom <= MIN_ZOOM}
          onClick={() => setZoom((z) => clamp(z - ZOOM_STEP, MIN_ZOOM, MAX_ZOOM))}
        >
          −
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

      <div className="table" ref={tableViewportRef}>
        <div
          className="table-content"
          ref={tableRef}
          style={{
            height: `${contentHeight}px`,
            transform: `scale(${zoom})`,
            transformOrigin: 'top center',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) closePopovers();
          }}
        >
          {tablePieces.length === 0 && (
            <p className="table-hint">כל השורות נגזרו... לחצי &quot;גזירה מחדש&quot; כדי לפזר שוב</p>
          )}
          {tablePieces.map((piece, i) => {
            if (piece.id === cuttingId) return null; // shown in the fixed overlay below instead
            return (
              <Strip
                key={piece.id}
                pieceId={piece.id}
                text={piece.text}
                dragging={draggingId === piece.id}
                onPointerDown={startTableDrag(piece)}
                className={initialIds.has(piece.id) ? 'strip--enter' : ''}
                style={{
                  position: 'absolute',
                  left: `${piece.x}%`,
                  top: `${piece.y}%`,
                  transform: 'translate(-50%, -50%)',
                  zIndex: draggingId === piece.id ? 50 : 1,
                  animationDelay: `${Math.min(i, 20) * 25}ms`,
                }}
              />
            );
          })}
        </div>
      </div>

      <div
        className={`poem-drawer ${poemOpen ? 'poem-drawer--open' : 'poem-drawer--collapsed'} ${poemHover ? 'poem-drawer--hover' : ''}`}
        ref={poemDropRef}
      >
        <button type="button" className="poem-drawer-handle" onClick={() => setPoemOpen((v) => !v)}>
          <span>השיר שלי{poemPieces.length > 0 ? ` (${poemPieces.length})` : ''}</span>
          <span className="poem-drawer-chevron" aria-hidden="true">
            {poemOpen ? '▾' : '▴'}
          </span>
        </button>
        {poemOpen && (
          <div className="poem-drawer-list" ref={poemListRef}>
            {poemPieces.length === 0 && (
              <p className="poem-drawer-hint">גררי שורות מהשולחן לכאן כדי לבנות את השיר</p>
            )}
            {poemPieces.map((item) => {
              if (item.id === cuttingId) return null; // shown in the fixed overlay below instead
              return (
                <div key={item.id} data-poem-id={item.id} className="poem-drawer-row">
                  <Strip
                    pieceId={item.id}
                    text={item.text}
                    dragging={draggingId === item.id}
                    onPointerDown={startPoemDrag(item)}
                    className="poem-drawer-strip"
                    style={{ position: 'static', transform: 'none' }}
                  />
                  <button
                    type="button"
                    className="poem-drawer-remove"
                    aria-label="הסירי שורה"
                    onClick={() => removeFromPoem(item.id)}
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {cuttingPiece && (
        <div className="cut-overlay" onClick={() => setCuttingId(null)}>
          <div onClick={(e) => e.stopPropagation()}>
            <Strip
              pieceId={cuttingPiece.id}
              text={cuttingPiece.text}
              cutting
              words={splitWords(cuttingPiece.text)}
              onCut={(splitIndex) => cutPiece(cuttingPiece.id, splitIndex)}
              onCancelCut={() => setCuttingId(null)}
              style={{ position: 'static', transform: 'none' }}
            />
          </div>
        </div>
      )}

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
