interface SimulationCallResult {
  status: "success" | "failure";
  error?: unknown;
}

export function assertSimulationCallResults(
  results: readonly SimulationCallResult[],
  stepNames: readonly string[] = [],
) {
  const failureIndex = results.findIndex(
    (result) => result.status === "failure",
  );
  if (failureIndex < 0) return;

  const error = results[failureIndex].error;
  const shortMessage =
    error && typeof error === "object" && "shortMessage" in error
      ? error.shortMessage
      : undefined;
  const fallbackMessage =
    error && typeof error === "object" && "message" in error
      ? error.message
      : undefined;
  const message =
    shortMessage != null
      ? String(shortMessage)
      : fallbackMessage != null
        ? String(fallbackMessage)
        : String(error ?? "Unknown simulation error");
  const stepName =
    stepNames[failureIndex] ??
    (failureIndex === 0 ? "Penalty approval" : "Reallocation");

  throw new Error(`${stepName} failed: ${message}`);
}
