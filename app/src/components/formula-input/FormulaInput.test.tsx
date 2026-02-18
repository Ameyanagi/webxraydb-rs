import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FormulaInput } from "~/components/formula-input/FormulaInput";
import { parse_formula, validate_formula } from "~/lib/wasm-api";

vi.mock("~/lib/wasm-api", () => ({
  validate_formula: vi.fn(),
  parse_formula: vi.fn(),
}));

describe("FormulaInput", () => {
  it("shows parsed components for a valid formula", async () => {
    vi.mocked(validate_formula).mockReturnValue(true);
    vi.mocked(parse_formula).mockReturnValue({
      components: [
        { symbol: "Fe", count: 2 },
        { symbol: "O", count: 3 },
      ],
    } as never);

    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<FormulaInput value="" onChange={onChange} />);

    await user.type(screen.getByRole("textbox"), "Fe2O3");
    expect(onChange).toHaveBeenCalled();
  });

  it("shows error for invalid formula", () => {
    vi.mocked(validate_formula).mockReturnValue(false);
    vi.mocked(parse_formula).mockReturnValue({ components: [] } as never);

    render(<FormulaInput value="bad" onChange={() => {}} />);
    expect(screen.getByText("Invalid formula")).toBeInTheDocument();
  });
});
