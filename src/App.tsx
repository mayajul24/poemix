import { useState } from 'react';
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

  const startCutting = (text: string) => {
    // .table has 8px margin on each side; a vertical scrollbar (desktop) eats a
    // little more, but this only has to be a decent estimate of the table's width
    const availableWidth = Math.max(280, window.innerWidth - 16);
    setStage({ kind: 'cutting', text, lines: textToLines(text), board: generatePieces(text, availableWidth) });
  };

  if (stage.kind === 'input') {
    return <InputScreen initialText={draftText} onSubmit={startCutting} />;
  }

  if (stage.kind === 'cutting') {
    return (
      <CuttingTransition
        lines={stage.lines}
        onDone={() => setStage({ kind: 'board', text: stage.text, board: stage.board })}
      />
    );
  }

  return (
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
  );
}
