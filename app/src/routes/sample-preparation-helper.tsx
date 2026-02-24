import { Link, createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "~/components/ui/PageHeader";

export const Route = createFileRoute("/sample-preparation-helper")({
  component: SamplePreparationHelperPage,
});

function SamplePreparationHelperPage() {
  return (
    <div className="space-y-4">
      <PageHeader
        title="Sample Preparation Helper"
        description="Quick navigation and guidance for sample preparation calculations."
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Link
          to="/sample-weight"
          className="rounded-lg border border-border bg-card p-4 transition-colors hover:bg-accent/30"
        >
          <h3 className="text-sm font-semibold">Sample Weight</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Estimate material loading from absorber, edge step, and geometry.
          </p>
        </Link>

        <Link
          to="/self-absorption"
          className="rounded-lg border border-border bg-card p-4 transition-colors hover:bg-accent/30"
        >
          <h3 className="text-sm font-semibold">Self Absorption</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Evaluate EXAFS fluorescence self-absorption suppression.
          </p>
        </Link>
      </div>
    </div>
  );
}
