// Single source of truth for VIN model-year decoding.
//
// Position 10 (index 9) encodes the year on a 30-year cycle. Position 7 (index 6)
// disambiguates the cycle: a LETTER there means the 2010+ cycle, a DIGIT means the
// 1980–2009 cycle. Many cars imported to Ethiopia are pre-2010, so this matters —
// without it old cars decode as recent.

const YEAR_MAP: Record<string, number> = {
  A: 1980, B: 1981, C: 1982, D: 1983, E: 1984, F: 1985, G: 1986, H: 1987,
  J: 1988, K: 1989, L: 1990, M: 1991, N: 1992, P: 1993, R: 1994, S: 1995,
  T: 1996, V: 1997, W: 1998, X: 1999, Y: 2000,
  "1": 2001, "2": 2002, "3": 2003, "4": 2004, "5": 2005,
  "6": 2006, "7": 2007, "8": 2008, "9": 2009,
};

/**
 * Decode the model year from a full 17-character VIN.
 * @returns the 4-digit year as a string, or "Unknown" if it can't be determined.
 */
export function decodeVinYear(vin: string): string {
  // Accept 17- and 18-char VINs; we only need positions 7 and 10 to be present.
  if (!vin || vin.length < 10) return "Unknown";

  const yearChar = vin.charAt(9).toUpperCase(); // position 10
  const pos7 = vin.charAt(6).toUpperCase(); // position 7 picks the 30-yr cycle

  const base = YEAR_MAP[yearChar];
  if (base === undefined) return "Unknown";

  // Letter in position 7 -> second cycle (2010+); digit -> first cycle (1980-2009).
  const secondCycle = /[A-Z]/.test(pos7);
  let year = secondCycle ? base + 30 : base;

  // Safety: never report a year in the future.
  const max = new Date().getFullYear() + 1;
  if (year > max) year -= 30;

  return year.toString();
}