import { useEffect, useState } from 'react';
import { InputScreen } from './components/InputScreen';
import { CutupBoard } from './components/CutupBoard';
import { CuttingTransition } from './components/CuttingTransition';
import { generatePieces, textToLines, type Board } from './lib/cutup';
import './App.css';

type Stage =
  | { kind: 'input' }
  | { kind: 'cutting'; text: string; lines: string[]; board: Board }
  | { kind: 'board'; text: string; board: Board };

export default function App() {
  const [stage, setStage] = useState<Stage>({ kind: 'input' });
  const [draftText, setDraftText] = useState('');
  const [updateReady, setUpdateReady] = useState(false);

  // main.tsx dispatches this instead of reloading the page itself, so a new
  // deploy landing mid-paste or mid-drag can't silently wipe unsaved work -
  // the user chooses when to reload.
  useEffect(() => {
    const handler = () => setUpdateReady(true);
    window.addEventListener('sw-update-ready', handler);
    return () => window.removeEventListener('sw-update-ready', handler);
  }, []);

  const startCutting = (text: string) => {
    // .table has 8px margin on each side; a vertical scrollbar (desktop) eats a
    // little more, but this only has to be a decent estimate of the table's width
    const availableWidth = Math.max(280, window.innerWidth - 16);
    setStage({ kind: 'cutting', text, lines: textToLines(text), board: generatePieces(text, availableWidth) });
  };

  const updateBanner = updateReady && (
    <div className="update-banner">
      <span>יש גרסה חדשה של האפליקציה</span>
      <button type="button" onClick={() => window.location.reload()}>
        רענני
      </button>
    </div>
  );

  if (stage.kind === 'input') {
    return (
      <>
        {updateBanner}
        <InputScreen initialText={draftText} onSubmit={startCutting} />
      </>
    );
  }

  if (stage.kind === 'cutting') {
    return (
      <>
        {updateBanner}
        <CuttingTransition
          lines={stage.lines}
          onDone={() => setStage({ kind: 'board', text: stage.text, board: stage.board })}
        />
      </>
    );
  }

  return (
    <>
      {updateBanner}
      <CutupBoard
        key={stage.board.pieces.map((p) => p.id).join('|')}
        initialPieces={stage.board.pieces}
        rows={stage.board.rows}
        originalText={stage.text}
        onNewText={() => {
          setDraftText('');
          setStage({ kind: 'input' });
        }}
        onEditOriginal={() => {
          setDraftText(stage.text);
          setStage({ kind: 'input' });
        }}
        onReshuffle={() => startCutting(stage.text)}
      />
    </>
  );
}
