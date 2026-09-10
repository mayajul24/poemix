export async function extractTextFromFile(file: File): Promise<string> {
  const name = file.name.toLowerCase();

  if (name.endsWith('.docx')) {
    const mammoth = await import('mammoth/mammoth.browser');
    const arrayBuffer = await file.arrayBuffer();
    // convertToHtml (not extractRawText) because mammoth's raw-text path silently
    // drops manual line breaks (Shift+Enter / w:br) with no space or newline in
    // their place, running adjacent words together. The HTML path renders them
    // as <br>, which htmlToText below turns back into a newline.
    const result = await mammoth.convertToHtml({ arrayBuffer });
    return htmlToText(result.value);
  }

  if (name.endsWith('.doc')) {
    throw new Error('קובצי .doc ישנים לא נתמכים - שמרי כ-.docx ונסי שוב.');
  }

  return await file.text();
}

function htmlToText(html: string): string {
  const withBreaks = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|li|h[1-6]|div|tr)>/gi, '\n');

  const container = document.createElement('div');
  container.innerHTML = withBreaks;
  return (container.textContent ?? '').replace(/\n{3,}/g, '\n\n').trim();
}
