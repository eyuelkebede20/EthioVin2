// healthGrade — derive a vehicle's health grade from aggregated signals. Pure
// (no DB); the caller gathers the aggregates so this stays testable. This is the
// ONLY thing the insurer exchange exposes about a vehicle's incident history — a
// grade + factor summary, never the raw claims/PII behind it.

export interface HealthInputs {
  claimSeverities: number[]; // 1–5 per insurance claim
  policeSeverities: number[]; // 1–5 per police report
  odometerRollbacks: number; // count of flagged (rollback) readings
  accidentCount: number; // count of accident events
}

export interface HealthGrade {
  score: number; // 0–100
  grade: "A" | "B" | "C" | "D" | "F";
  factors: string[]; // human-readable contributors (no PII)
}

export function computeHealthGrade(inp: HealthInputs): HealthGrade {
  let score = 100;
  const factors: string[] = [];

  const claimHit = inp.claimSeverities.reduce((s, v) => s + v * 5, 0);
  if (claimHit) {
    score -= claimHit;
    factors.push(`${inp.claimSeverities.length} insurance claim(s)`);
  }
  const policeHit = inp.policeSeverities.reduce((s, v) => s + v * 4, 0);
  if (policeHit) {
    score -= policeHit;
    factors.push(`${inp.policeSeverities.length} police report(s)`);
  }
  if (inp.odometerRollbacks > 0) {
    score -= inp.odometerRollbacks * 15;
    factors.push(`${inp.odometerRollbacks} odometer rollback flag(s)`);
  }
  if (inp.accidentCount > 0) {
    score -= inp.accidentCount * 10;
    factors.push(`${inp.accidentCount} accident event(s)`);
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  const grade = score >= 90 ? "A" : score >= 75 ? "B" : score >= 60 ? "C" : score >= 40 ? "D" : "F";
  if (factors.length === 0) factors.push("No adverse events on record");
  return { score, grade, factors };
}
