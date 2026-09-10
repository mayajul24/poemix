export async function extractTextFromFile(file: File): Promise<string> {
  const name = file.name.toLowerCase();

  if (name.endsWith('.docx')) {
    const mammoth = await import('mammoth/mammoth.browser');
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
  }

  if (name.endsWith('.doc')) {
    throw new Error('קובצי .doc ישנים לא נתמכים - שמרי כ-.docx ונסי שוב.');
  }

  return await file.text();
}
