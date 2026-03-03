import * as XLSX from 'xlsx';

export type ExcelColumn = {
  header: string;
  /** 'string' → texto, 'integer' → número entero, 'number' → número decimal */
  type: 'string' | 'integer' | 'number';
  width?: number;
};

/**
 * Genera y descarga un archivo .xlsx con tipos de celda correctos para
 * que Excel reconozca los valores numéricos y permita hacer cálculos.
 */
export function downloadExcel(
  filename: string,
  sheetName: string,
  columns: ExcelColumn[],
  rows: Array<Array<string | number | null | undefined>>,
) {
  const wb = XLSX.utils.book_new();

  // Fila de encabezados + filas de datos con tipos correctos
  const aoa: (string | number)[][] = [
    columns.map((c) => c.header),
    ...rows.map((row) =>
      row.map((cell, i) => {
        const col = columns[i];
        if (!col) return cell == null ? '' : String(cell);
        if (col.type === 'number' || col.type === 'integer') {
          const n = Number(cell);
          return isNaN(n) ? 0 : n;
        }
        return cell == null ? '' : String(cell);
      }),
    ),
  ];

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Ancho de columnas
  ws['!cols'] = columns.map((col) => ({ wch: col.width ?? 18 }));

  // Formato de número para celdas numéricas (a partir de fila 1, índice 0 = encabezado)
  const ref = ws['!ref'];
  if (ref) {
    const range = XLSX.utils.decode_range(ref);
    for (let r = range.s.r + 1; r <= range.e.r; r++) {
      columns.forEach((col, c) => {
        if (col.type === 'number' || col.type === 'integer') {
          const addr = XLSX.utils.encode_cell({ r, c });
          const cell = ws[addr];
          if (cell && cell.t === 'n') {
            cell.z = col.type === 'integer' ? '#,##0' : '#,##0.00';
          }
        }
      });
    }
  }

  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
}
