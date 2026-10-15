let measurementSequence = 0;

type MeasurementDetails = Record<string, number | string | boolean | null | undefined>;

export function startDevMeasurement(label: string) {
  if (process.env.NODE_ENV !== "development") {
    return (_details?: MeasurementDetails) => undefined;
  }

  const id = ++measurementSequence;
  const startedAt = performance.now();

  return (details: MeasurementDetails = {}) => {
    const durationMs = Math.round((performance.now() - startedAt) * 10) / 10;
    console.info(`[perf:${id}] ${label}: ${durationMs} ms`, details);
  };
}
