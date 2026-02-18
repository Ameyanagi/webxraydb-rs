import { validateRange } from "~/lib/inputs";

interface EnergyRangeInputProps {
  start: number;
  end: number;
  step: number;
  onStartChange: (v: number) => void;
  onEndChange: (v: number) => void;
  onStepChange: (v: number) => void;
  label?: string;
}

const STEP_PRESETS = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];

export function EnergyRangeInput({
  start,
  end,
  step,
  onStartChange,
  onEndChange,
  onStepChange,
  label = "Energy Range (eV)",
}: EnergyRangeInputProps) {
  const range = validateRange(start, end, step, 50000);

  return (
    <div className="space-y-2">
      {label && (
        <label className="block text-sm font-medium text-foreground">
          {label}
        </label>
      )}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex-1">
          <label className="mb-1 block text-xs text-muted-foreground">
            Start (eV)
          </label>
          <input
            type="number"
            value={start}
            onChange={(e) => onStartChange(Number(e.target.value))}
            aria-invalid={!range.valid}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring aria-[invalid=true]:border-destructive"
          />
        </div>
        <div className="flex-1">
          <label className="mb-1 block text-xs text-muted-foreground">
            End (eV)
          </label>
          <input
            type="number"
            value={end}
            onChange={(e) => onEndChange(Number(e.target.value))}
            aria-invalid={!range.valid}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring aria-[invalid=true]:border-destructive"
          />
        </div>
        <div className="flex-1">
          <label className="mb-1 block text-xs text-muted-foreground">
            Step (eV)
          </label>
          <select
            value={step}
            onChange={(e) => onStepChange(Number(e.target.value))}
            aria-invalid={!range.valid}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring aria-[invalid=true]:border-destructive"
          >
            {STEP_PRESETS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>
      {range.valid ? (
        <p className="text-xs text-muted-foreground">{range.points} points</p>
      ) : (
        <p className="text-xs text-destructive">{range.error}</p>
      )}
    </div>
  );
}
