/** Remove legacy boilerplate from saved daily reports (pre-template change). */
export function sanitizeDailyReportMarkdown(markdown: string): string {
  const lines = markdown.split('\n').filter((line) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('- **Window:**') || trimmed.startsWith('- **Tenant user:**')) {
      return false;
    }
    if (trimmed.includes('This file is generated automatically')) {
      return false;
    }
    return true;
  });

  while (lines.length > 0) {
    const tail = lines[lines.length - 1].trim();
    if (tail === '' || tail === '---') {
      lines.pop();
      continue;
    }
    break;
  }

  return lines.join('\n');
}
