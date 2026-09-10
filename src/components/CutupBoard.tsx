import { useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { makePieceId, splitWords, type Piece } from '../lib/cutup';
import { Strip } from './Strip';

interface PoemItem {
  id: string;
  text: string;
}

interface CutupBoardProps {
  initialPieces: Piece[];
  onNewText: () => void;
  onReshuffle: () => void;
}

const TAP_THRESHOLD = 8; // px of movement below which a pointer gesture counts as a tap, not a drag

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function isPointInRect(x: number, y: number, rect: DOMRect | null): boolean {
  if (!rect) return false;
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

export function CutupBoard({ initialPieces, onNewText, onReshuffle }: CutupBoardProps) {
  const [tablePieces, setTablePieces] = useState<Piece[]>(initialPieces);
  const [poem, setPoem] = useState<PoemItem[]>([]);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [cuttingId, setCuttingId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const tableRef = useRef<HTMLDivElement>(null);
  const poemListRef = useRef<HTMLDivElement>(null);
  const poemPanelRef = useRef<HTMLDivElement>(null);

  const startTableDrag = (piece: Piece) => (e: ReactPointerEvent) => {
    const target = e.currentTarget as HTMLElement;
    try {
      target.setPointerCapture(e.pointerId);
    } catch {
      // capture is a nice-to-have; the window-level listeners below still drive the drag
    }

    if (cuttingId && cuttingId !== piece.id) setCuttingId(null);

    const tableRect = tableRef.current?.getBoundingClientRect() ?? null;
    const poemRect = poemPanelRef.current?.getBoundingClientRect() ?? null;
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

      if (isPointInRect(ev.clientX, ev.clientY, poemRect)) {
        setTablePieces((prev) => prev.filter((p) => p.id !== piece.id));
        setPoem((prev) => [...prev, { id: piece.id, text: piece.text }]);
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

    const poemRect = poemPanelRef.current?.getBoundingClientRect() ?? null;
    const tableRect = tableRef.current?.getBoundingClientRect() ?? null;
    const startClientX = e.clientX;
    const startClientY = e.clientY;
    setDraggingId(item.id);

    const handleMove = (ev: PointerEvent) => {
      if (!poemListRef.current) return;
      const rows = Array.from(
        poemListRef.current.querySelectorAll<HTMLElement>('[data-piece-id]'),
      );
      const others = rows.filter((r) => r.dataset.pieceId !== item.id);
      let idx = 0;
      for (const r of others) {
        const rect = r.getBoundingClientRect();
        const mid = rect.top + rect.height / 2;
        if (ev.clientY > mid) idx++;
      }
      setPoem((prev) => {
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
        setPoem((prev) => prev.filter((p) => p.id !== item.id));
        const nx = clamp(((ev.clientX - tableRect.left) / tableRect.width) * 100, 2, 98);
        const ny = clamp(((ev.clientY - tableRect.top) / tableRect.height) * 100, 2, 98);
        setTablePieces((prev) => [
          ...prev,
          { id: item.id, text: item.text, x: nx, y: ny, rot: (Math.random() - 0.5) * 24 },
        ]);
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

  const cutPoemPiece = (id: string, splitIndex: number) => {
    setPoem((prev) => {
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

  const removeFromPoem = (id: string) => {
    const item = poem.find((p) => p.id === id);
    if (!item || !tableRef.current) return;
    setPoem((prev) => prev.filter((p) => p.id !== id));
    setTablePieces((prev) => [
      ...prev,
      { id: item.id, text: item.text, x: 50 + (Math.random() - 0.5) * 20, y: 12, rot: (Math.random() - 0.5) * 24 },
    ]);
  };

  const copyPoem = async () => {
    const textOut = poem.map((p) => p.text).join('\n');
    try {
      await navigator.clipboard.writeText(textOut);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard API unavailable; ignore silently
    }
  };

  return (
    <div className="screen board-screen">
      <header className="board-header">
        <button type="button" className="btn btn--ghost btn--small" onClick={onNewText}>
          טקסט חדש
        </button>
        <button type="button" className="btn btn--ghost btn--small" onClick={onReshuffle}>
          גזירה מחדש
        </button>
      </header>

      <div
        className="table"
        ref={tableRef}
        onClick={(e) => {
          if (e.target === e.currentTarget && cuttingId) setCuttingId(null);
        }}
      >
        {tablePieces.length === 0 && (
          <p className="table-hint">כל השורות על השולחן... הן ב&quot;שיר שלי&quot; למטה</p>
        )}
        {tablePieces.map((piece) => {
          const isCutting = cuttingId === piece.id;
          return (
            <Strip
              key={piece.id}
              text={piece.text}
              dragging={draggingId === piece.id}
              cutting={isCutting}
              words={isCutting ? splitWords(piece.text) : undefined}
              onCut={(splitIndex) => cutTablePiece(piece.id, splitIndex)}
              onCancelCut={() => setCuttingId(null)}
              onPointerDown={isCutting ? undefined : startTableDrag(piece)}
              style={{
                position: 'absolute',
                left: isCutting ? '50%' : `${piece.x}%`,
                top: isCutting ? '46%' : `${piece.y}%`,
                transform: `translate(-50%, -50%) rotate(${isCutting ? 0 : piece.rot}deg)`,
                zIndex: draggingId === piece.id || isCutting ? 50 : 1,
              }}
            />
          );
        })}
      </div>

      <div
        className="poem-panel"
        ref={poemPanelRef}
        onClick={(e) => {
          if (e.target === e.currentTarget && cuttingId) setCuttingId(null);
        }}
      >
        <div className="poem-panel-head">
          <h2>השיר שלי</h2>
          <button
            type="button"
            className="btn btn--ghost btn--small"
            disabled={poem.length === 0}
            onClick={copyPoem}
          >
            {copied ? 'הועתק ✓' : 'העתיקי שיר'}
          </button>
        </div>
        <div className="poem-list" ref={poemListRef}>
          {poem.length === 0 && (
            <p className="poem-hint">גררי לכאן שורות מהשולחן כדי לבנות שיר</p>
          )}
          {poem.map((item) => {
            const isCutting = cuttingId === item.id;
            return (
              <div
                key={item.id}
                data-piece-id={item.id}
                className={`poem-row ${draggingId === item.id ? 'poem-row--dragging' : ''}`}
              >
                <Strip
                  text={item.text}
                  dragging={draggingId === item.id}
                  cutting={isCutting}
                  words={isCutting ? splitWords(item.text) : undefined}
                  onCut={(splitIndex) => cutPoemPiece(item.id, splitIndex)}
                  onCancelCut={() => setCuttingId(null)}
                  onPointerDown={isCutting ? undefined : startPoemDrag(item)}
                  className="poem-strip"
                />
                <button
                  type="button"
                  className="poem-remove"
                  aria-label="הסירי שורה"
                  onClick={() => removeFromPoem(item.id)}
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
