import { useState } from 'react';
import type { CSSProperties, PointerEvent } from 'react';

interface StripProps {
  text: string;
  style?: CSSProperties;
  onPointerDown?: (e: PointerEvent) => void;
  dragging?: boolean;
  className?: string;
  cutting?: boolean;
  words?: string[];
  onCut?: (splitIndex: number) => void;
  onCancelCut?: () => void;
  pieceId?: string;
}

const SNIP_DURATION_MS = 240;

function ScissorsIcon() {
  return (
    <svg
      className="cut-gap-icon"
      width="13"
      height="13"
      viewBox="0 0 28 28"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="7" cy="7" r="3.2" />
      <circle cx="7" cy="21" r="3.2" />
      <line x1="23" y1="4" x2="9" y2="18" />
      <line x1="9" y1="10" x2="23" y2="24" />
    </svg>
  );
}

export function Strip({
  text,
  style,
  onPointerDown,
  dragging,
  className = '',
  cutting = false,
  words,
  onCut,
  onCancelCut,
  pieceId,
}: StripProps) {
  // local, transient: once a gap is tapped the two halves visually pull apart for a
  // beat before the real cut (and the fixed overlay closing) happens underneath it
  const [snipIndex, setSnipIndex] = useState<number | null>(null);

  const handleGapClick = (splitIndex: number) => {
    if (snipIndex !== null) return; // already mid-snip, ignore extra taps
    setSnipIndex(splitIndex);
    setTimeout(() => onCut?.(splitIndex), SNIP_DURATION_MS);
  };

  if (cutting && words) {
    return (
      <div className={`strip strip--cutting ${className}`} style={style} data-piece-id={pieceId}>
        <div className="cut-words" dir="auto">
          {words.map((word, i) => {
            const pullClass =
              snipIndex === null ? '' : i < snipIndex ? 'cut-word-group--pull-a' : 'cut-word-group--pull-b';
            return (
              <span className={`cut-word-group ${pullClass}`} key={i}>
                <span className="cut-word">{word}</span>
                {i < words.length - 1 && (
                  <button
                    type="button"
                    className="cut-gap"
                    aria-label="גזרי כאן"
                    disabled={snipIndex !== null}
                    onClick={() => handleGapClick(i + 1)}
                  >
                    {snipIndex === i + 1 ? (
                      <span className="snip-flash" aria-hidden="true">
                        ✂️
                      </span>
                    ) : (
                      <ScissorsIcon />
                    )}
                  </button>
                )}
              </span>
            );
          })}
          <button
            type="button"
            className="cut-cancel"
            aria-label="בטלי גזירה"
            onClick={() => onCancelCut?.()}
          >
            ×
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`strip ${dragging ? 'strip--dragging' : ''} ${className}`}
      style={style}
      onPointerDown={onPointerDown}
      data-piece-id={pieceId}
    >
      <span dir="auto">{text}</span>
    </div>
  );
}
