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
  if (cutting && words) {
    return (
      <div className={`strip strip--cutting ${className}`} style={style} data-piece-id={pieceId}>
        <div className="cut-words" dir="auto">
          {words.map((word, i) => (
            <span className="cut-word-group" key={i}>
              <span className="cut-word">{word}</span>
              {i < words.length - 1 && (
                <button
                  type="button"
                  className="cut-gap"
                  aria-label="גזרי כאן"
                  onClick={() => onCut?.(i + 1)}
                >
                  <span className="cut-gap-line" />
                </button>
              )}
            </span>
          ))}
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
