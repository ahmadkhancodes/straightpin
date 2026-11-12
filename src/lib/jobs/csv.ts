/** One CSV cell. Quotes everything and defuses spreadsheet formulas (a cell starting with = + - @ tab or CR). */
export function csvCell(v: unknown): string {
  let s = v === null || v === undefined ? "" : v instanceof Date ? v.toISOString().slice(0, 10) : String(v);
  s = s.replace(/\r\n|\r|\n/g, " ");
  if (/^[=+\-@\t]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export function toCsv(rows: unknown[][]): string {
  // BOM so Excel reads UTF-8; CRLF per RFC 4180.
  return "﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
