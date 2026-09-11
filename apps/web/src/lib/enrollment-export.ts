export function enrollmentCsv(rows: readonly (readonly unknown[])[]): string {
  const cell = (value: unknown) => {
    const text = String(value ?? '')
    // Treat user-provided names/documents as text when opened in spreadsheet apps.
    const safe = /^[\s]*[=+@-]/.test(text) ? "'" + text : text
    return '"' + safe.replace(/"/g, '""') + '"'
  }
  return '\uFEFF' + rows.map(row => row.map(cell).join(';')).join('\r\n')
}
