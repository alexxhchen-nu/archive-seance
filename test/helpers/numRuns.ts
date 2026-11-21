export function numRuns(defaultRuns: number): number {
  return Number(process.env.FC_NUM_RUNS) || defaultRuns;
}
