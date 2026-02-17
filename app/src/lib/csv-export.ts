/** Download an array of rows as a CSV file. */
export function downloadCsv(
  filename: string,
  headers: string[],
  rows: string[][],
) {
  const lines = [
    headers.join(","),
    ...rows.map((row) =>
      row.map((cell) => (cell.includes(",") ? `"${cell}"` : cell)).join(","),
    ),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
