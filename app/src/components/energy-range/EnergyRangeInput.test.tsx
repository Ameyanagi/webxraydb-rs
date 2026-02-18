import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EnergyRangeInput } from "~/components/energy-range/EnergyRangeInput";

describe("EnergyRangeInput", () => {
  it("shows number of points for a valid range", () => {
    render(
      <EnergyRangeInput
        start={100}
        end={200}
        step={10}
        onStartChange={vi.fn()}
        onEndChange={vi.fn()}
        onStepChange={vi.fn()}
      />,
    );

    expect(screen.getByText("11 points")).toBeInTheDocument();
  });

  it("shows validation error for invalid range", () => {
    render(
      <EnergyRangeInput
        start={200}
        end={100}
        step={10}
        onStartChange={vi.fn()}
        onEndChange={vi.fn()}
        onStepChange={vi.fn()}
      />,
    );

    expect(screen.getByText("End must be greater than start")).toBeInTheDocument();
  });
});
