import { useRef, useState } from 'react';
import { extractTextFromFile } from '../lib/docx';

interface InputScreenProps {
  onSubmit: (text: string) => void;
}

export function InputScreen({ onSubmit }: InputScreenProps) {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setError(null);
    try {
      const extracted = await extractTextFromFile(file);
      setText(extracted);
      setFileName(file.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'קריאת הקובץ נכשלה');
    }
  };

  const canSubmit = text.trim().length > 0;

  return (
    <div className="screen input-screen">
      <h1>גזירה</h1>
      <p className="subtitle">כתבי טקסט חופשי, גזרי אותו לשורות, ובני משיר מהגזירים</p>

      <textarea
        className="text-input"
        placeholder="כתבי כאן את הטקסט שלך..."
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setFileName(null);
        }}
      />

      <div className="file-row">
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => fileInputRef.current?.click()}
        >
          העלי קובץ (.docx / .txt)
        </button>
        {fileName && <span className="file-name">{fileName}</span>}
        <input
          ref={fileInputRef}
          type="file"
          accept=".docx,.txt"
          className="file-input-hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = '';
          }}
        />
      </div>

      {error && <p className="error">{error}</p>}

      <button
        type="button"
        className="btn btn--primary"
        disabled={!canSubmit}
        onClick={() => onSubmit(text)}
      >
        גזרי לשורות ✂️
      </button>
    </div>
  );
}
