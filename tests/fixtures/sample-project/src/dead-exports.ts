// These exports are intentionally never imported anywhere in the sample project

export function unusedHelper(x: number): number {
  return x * 2;
}

export const UNUSED_CONSTANT = "never-used";

export class UnusedService {
  run() {
    return "running";
  }
}

export interface UnusedConfig {
  enabled: boolean;
  timeout: number;
}

export type UnusedStatus = "active" | "inactive";
