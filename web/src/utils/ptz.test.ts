import { describe, expect, it } from "vitest";
import { relativeMoveCommand } from "./ptz";

const size = { width: 400, height: 200 };

describe("relativeMoveCommand", () => {
  it("clicking the centre does not move", () => {
    expect(
      relativeMoveCommand({ x: 200, y: 100 }, { x: 200, y: 100 }, size),
    ).toBe("move_relative_0_0");
  });

  it("clicking the top right corner pans right and tilts up", () => {
    expect(relativeMoveCommand({ x: 400, y: 0 }, { x: 400, y: 0 }, size)).toBe(
      "move_relative_1_1",
    );
  });

  it("dragging down and right zooms in on the box centre", () => {
    const cmd = relativeMoveCommand(
      { x: 200, y: 100 },
      { x: 300, y: 150 },
      size,
    );
    expect(cmd).toBe("move_relative_0.25_-0.25_0.5");
  });

  it("dragging up and left zooms out", () => {
    const cmd = relativeMoveCommand(
      { x: 300, y: 150 },
      { x: 200, y: 100 },
      size,
    );
    expect(cmd).toBe("move_relative_0.25_-0.25_-0.5");
  });

  it("returns nothing before the overlay has a size", () => {
    expect(
      relativeMoveCommand(
        { x: 1, y: 1 },
        { x: 1, y: 1 },
        { width: 0, height: 0 },
      ),
    ).toBeUndefined();
  });
});
