import type { ToolReference } from "~/docs/types";

interface ReferenceListProps {
  references: ToolReference[];
}

export function ReferenceList({ references }: ReferenceListProps) {
  return (
    <ol className="space-y-2 text-sm text-muted-foreground">
      {references.map((ref, index) => (
        <li key={`${ref.citation}-${index}`} className="rounded-md border border-border bg-card p-3">
          <p className="text-foreground">
            [{index + 1}] {ref.citation}
          </p>
          <div className="mt-1 flex flex-wrap gap-3 text-xs">
            {ref.doi && (
              <a
                href={`https://doi.org/${ref.doi}`}
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline"
              >
                DOI: {ref.doi}
              </a>
            )}
            {ref.url && (
              <a
                href={ref.url}
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline"
              >
                Source link
              </a>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
