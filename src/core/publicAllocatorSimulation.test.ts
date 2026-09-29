import { describe, expect, test } from "vitest";
import { assertSimulationCallResults } from "./publicAllocatorSimulation";

describe("assertSimulationCallResults", () => {
  test("reports the first failed step with the short message", () => {
    expect(() =>
      assertSimulationCallResults(
        [
          { status: "success" },
          {
            status: "failure",
            error: Object.assign(new Error("long message"), {
              shortMessage: "reverted",
            }),
          },
          { status: "failure", error: new Error("later failure") },
        ],
        ["Penalty approval", "Reallocation", "Reallocation"],
      ),
    ).toThrow("Reallocation failed: reverted");
  });

  test("reports success when all calls succeed", () => {
    expect(() =>
      assertSimulationCallResults([
        { status: "success" },
        { status: "success" },
      ]),
    ).not.toThrow();
  });

  test("uses the error message when no short message is available", () => {
    expect(() =>
      assertSimulationCallResults([
        { status: "failure", error: new Error("approval reverted") },
      ]),
    ).toThrow("Penalty approval failed: approval reverted");
  });
});
