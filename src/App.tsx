import { useState } from 'react';
import { InputScreen } from './components/InputScreen';
import { CutupBoard } from './components/CutupBoard';
import { generatePieces, type Piece } from './lib/cutup';
import './App.css';

export default function App() {
  const [rawText, setRawText] = useState<string | null>(null);
  const [pieces, setPieces] = useState<Piece[]>([]);

  if (rawText === null) {
    return (
      <InputScreen
        onSubmit={(text) => {
          setRawText(text);
          setPieces(generatePieces(text));
        }}
      />
    );
  }

  return (
    <CutupBoard
      key={pieces.map((p) => p.id).join('|')}
      initialPieces={pieces}
      onNewText={() => setRawText(null)}
      onReshuffle={() => setPieces(generatePieces(rawText))}
    />
  );
}
