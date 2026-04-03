import { useMemo } from 'react';
import Papa from 'papaparse';

interface CsvViewerProps {
  content: string;
}

export default function CsvViewer({ content }: CsvViewerProps) {
  const { data, errors } = useMemo(() => {
    return Papa.parse<any[]>(content, {
      header: false,
      skipEmptyLines: true,
    });
  }, [content]);

  if (!content) {
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

  return (
    <div className="w-full h-full p-4 overflow-auto">
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
            {rows.map((row: any[], rowIndex: number) => (
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
