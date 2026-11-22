import { useMemo, useState } from 'react';
import Papa from 'papaparse';

interface CsvViewerProps {
  content: string;
}

const PREVIEW_ROW_LIMIT = 500;

export default function CsvViewer({ content }: CsvViewerProps) {
  const [showAll, setShowAll] = useState(false);

  const { data, errors } = useMemo(() => {
    if (!content || !content.trim()) {
      return { data: [], errors: [] };
    }
    return Papa.parse<any[]>(content, {
      header: false,
      skipEmptyLines: true,
    });
  }, [content]);

  if (!content || !content.trim()) {
    return <div className="p-8 text-center text-muted-foreground w-full flex-1">Empty CSV file</div>;
  }

  if (errors.length > 0 && data.length === 0) {
    return (
      <div className="p-8 text-center text-destructive w-full flex-1">
        Failed to parse CSV file: {errors[0].message}
      </div>
    );
  }

  const [headerRow, ...rows] = data;
  const hasMoreRows = rows.length > PREVIEW_ROW_LIMIT;
  const visibleRows = showAll ? rows : rows.slice(0, PREVIEW_ROW_LIMIT);

  return (
    <div className="w-full h-full p-4 overflow-auto space-y-3">
      {hasMoreRows && (
        <div className="flex items-center justify-between text-xs text-muted-foreground bg-muted/40 border border-border/50 rounded-md px-3 py-2">
          <span>
            Showing {visibleRows.length.toLocaleString()} of {rows.length.toLocaleString()} rows
          </span>
          <button
            type="button"
            onClick={() => setShowAll((prev) => !prev)}
            className="text-primary hover:underline font-medium"
          >
            {showAll ? `Collapse to ${PREVIEW_ROW_LIMIT} rows` : `Show all ${rows.length.toLocaleString()} rows`}
          </button>
        </div>
      )}
      <div className="rounded-md border border-white/10 overflow-hidden bg-background/50">
        <table className="w-full text-sm text-left shadow-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              {headerRow?.map((cell: any, index: number) => (
                <th key={index} className="px-4 py-3 font-semibold border-b border-border/50 text-foreground text-xs uppercase tracking-wider">
                  {cell}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {visibleRows.map((row: any[], rowIndex: number) => (
              <tr key={rowIndex} className="hover:bg-muted/30 transition-colors">
                {row.map((cell: any, cellIndex: number) => (
                  <td key={cellIndex} className="px-4 py-2 border-r border-border/20 last:border-r-0 whitespace-nowrap overflow-hidden text-ellipsis max-w-[300px]" title={cell}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
