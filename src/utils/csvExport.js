/**
 * CSV utilities — client-side, zero-cost.
 *
 * Handles:
 * - Proper field escaping (commas, quotes, newlines)
 * - UTF-8 BOM so Excel opens Sinhala/Tamil text correctly
 * - Browser download trigger
 */

function escapeCSVField(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  // Wrap in quotes if it contains comma, quote, newline, or carriage return
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Generate a CSV string from an array of row objects.
 * @param {Array<Object>} rows - array of row objects
 * @param {Array<{key:string,label:string,map?:function}>} columns - column definitions
 * @returns {string} CSV text with UTF-8 BOM
 */
export function generateCSV(rows, columns) {
  const header = columns.map((c) => escapeCSVField(c.label)).join(',');

  const body = (rows || [])
    .map((row) =>
      columns
        .map((c) => {
          const raw = c.map ? c.map(row) : row[c.key];
          return escapeCSVField(raw);
        })
        .join(',')
    )
    .join('\r\n');

  // U+FEFF BOM makes Excel treat the file as UTF-8 instead of ANSI
  return '\uFEFF' + header + '\r\n' + body;
}

/**
 * Trigger a browser download of a text file.
 */
export function downloadTextFile(filename, content, mime = 'text/csv;charset=utf-8;') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 0);
}

/**
 * Build a filename with today's date.
 */
export function datedFilename(prefix, ext = 'csv') {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${prefix}-${yyyy}-${mm}-${dd}.${ext}`;
}

/**
 * Format a date column consistently.
 */
export function formatDateForCSV(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

/**
 * Format items array as a compact string for CSV.
 * e.g. "Blue Shirt (M) x2; Red Cap x1"
 */
export function formatItemsForCSV(items) {
  if (!Array.isArray(items) || items.length === 0) return '';
  return items
    .map((it) => {
      const qty = Number(it.quantity) || 1;
      return `${it.title || 'Item'} x${qty}`;
    })
    .join('; ');
}