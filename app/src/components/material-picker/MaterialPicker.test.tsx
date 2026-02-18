import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MaterialPicker } from "~/components/material-picker/MaterialPicker";
import { list_materials } from "~/lib/wasm-api";

vi.mock("~/lib/wasm-api", () => ({
  list_materials: vi.fn(),
}));

describe("MaterialPicker", () => {
  it("filters materials and selects one", async () => {
    vi.mocked(list_materials).mockReturnValue([
      { name: "water", formula: "H2O", density: 1.0 },
      { name: "kapton", formula: "C22H10N2O5", density: 1.42 },
    ] as never);

    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<MaterialPicker onSelect={onSelect} />);

    const input = screen.getByPlaceholderText(/Search materials/i);
    await user.click(input);
    await user.type(input, "kap");

    await user.click(screen.getByRole("button", { name: /kapton/i }));
    expect(onSelect).toHaveBeenCalledWith("C22H10N2O5", 1.42);
  });
});
