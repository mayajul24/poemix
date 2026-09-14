import { useState } from 'react';
import { InputScreen } from './components/InputScreen';
import { CutupBoard } from './components/CutupBoard';
import { generatePieces, type Board } from './lib/cutup';
import './App.css';

export default function App() {
  const [rawText, setRawText] = useState<string | null>(null);
  const [board, setBoard] = useState<Board>({ pieces: [], rows: 0 });
  const [draftText, setDraftText] = useState('');

  if (rawText === null) {
    return (
      <InputScreen
        initialText={draftText}
        onSubmit={(text) => {
          setRawText(text);
          setBoard(generatePieces(text));
        }}
      />
    );
  }

  return (
    <CutupBoard
      key={board.pieces.map((p) => p.id).join('|')}
      initialPieces={board.pieces}
      rows={board.rows}
      originalText={rawText}
      onNewText={() => {
        setDraftText('');
        setRawText(null);
      }}
      onEditOriginal={() => {
        setDraftText(rawText);
        setRawText(null);
      }}
      onReshuffle={() => setBoard(generatePieces(rawText))}
    />
  );
}
