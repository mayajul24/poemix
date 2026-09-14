import { useEffect, useRef } from 'react';

interface CuttingTransitionProps {
  lines: string[];
  onDone: () => void;
}

const MAX_LINES = 7;
const DURATION_MS = 900;
const SPLIT_MS = 380;

export function CuttingTransition({ lines, onDone }: CuttingTransitionProps) {
  const shown = lines.length > 0 ? lines.slice(0, MAX_LINES) : [''];
  const calledRef = useRef(false);

  useEffect(() => {
    const t = setTimeout(() => {
      if (!calledRef.current) {
        calledRef.current = true;
        onDone();
      }
    }, DURATION_MS);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div className="cutting-transition">
      <div className="cutting-page">
        {shown.map((line, i) => {
          const mid = Math.ceil(line.length / 2) || 0;
          // roughly when the blade sweeps past this line's vertical position
          const passTime = ((i + 0.5) / shown.length) * DURATION_MS;
          const delay = Math.max(0, passTime - SPLIT_MS / 2);
          return (
            <div className="cutting-line" dir="auto" key={i}>
              <span className="cutting-half cutting-half--a" style={{ animationDelay: `${delay}ms` }}>
                {line.slice(0, mid)}
              </span>
              <span className="cutting-half cutting-half--b" style={{ animationDelay: `${delay}ms` }}>
                {line.slice(mid)}
              </span>
            </div>
          );
        })}
        <div className="cutting-blade" style={{ animationDuration: `${DURATION_MS}ms` }} />
      </div>
    </div>
  );
}
