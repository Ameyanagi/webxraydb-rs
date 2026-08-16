/** Quote a CSV cell per RFC 4180: `"` doubles, and any of `," \n \r` forces quoting. */
function escapeCsvCell(cell: string): string {
  if (/[",\n\r]/.test(cell)) {
    return `"${cell.replace(/"/g, '""')}"`;
  }
  return cell;
}

/** Download an array of rows as a CSV file. */
export function downloadCsv(
  filename: string,
  headers: string[],
  rows: string[][],
) {
  const lines = [
    headers.map(escapeCsvCell).join(","),
    ...rows.map((row) => row.map(escapeCsvCell).join(",")),
  ];
  const blob = new Blob([lines.join("\r\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  // Keep the anchor in the DOM for the click and defer the revoke — WebKit
  // cancels an in-flight download whose object URL is revoked immediately.
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
