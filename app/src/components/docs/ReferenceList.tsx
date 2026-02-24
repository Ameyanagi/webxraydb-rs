import type { ToolReference } from "~/docs/types";

interface ReferenceListProps {
  references: ToolReference[];
}

export function ReferenceList({ references }: ReferenceListProps) {
  return (
    <ol className="space-y-2 text-sm">
      {references.map((ref, index) => (
        <li key={`${ref.citation}-${index}`} className="flex gap-2.5">
          <span className="mt-0.5 flex h-5 min-w-5 shrink-0 items-center justify-center rounded bg-muted text-[10px] font-bold text-muted-foreground">
            {index + 1}
          </span>
          <div className="min-w-0 flex-1">
            <p className="leading-relaxed text-foreground/90">{ref.citation}</p>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs">
              {ref.doi && (
                <a
                  href={`https://doi.org/${ref.doi}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" className="shrink-0">
                    <path d="M7.5 5.5v2a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4a1 1 0 011-1h2" />
                    <path d="M6 1.5h2.5V4" />
                    <path d="M4.5 5.5L8.5 1.5" />
                  </svg>
                  {ref.doi}
                </a>
              )}
              {ref.url && !ref.doi && (
                <a
                  href={ref.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" className="shrink-0">
                    <path d="M7.5 5.5v2a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4a1 1 0 011-1h2" />
                    <path d="M6 1.5h2.5V4" />
                    <path d="M4.5 5.5L8.5 1.5" />
                  </svg>
                  Source
                </a>
              )}
              {ref.url && ref.doi && (
                <a
                  href={ref.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" className="shrink-0">
                    <path d="M7.5 5.5v2a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4a1 1 0 011-1h2" />
                    <path d="M6 1.5h2.5V4" />
                    <path d="M4.5 5.5L8.5 1.5" />
                  </svg>
                  Website
                </a>
              )}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
