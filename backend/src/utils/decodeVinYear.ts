/**
 * Extracts the exact manufacturing year from a 17-digit ISO VIN.
 * @param {string} vin - The 17-character VIN string.
 * @returns {number|null} The calculated year.
 */
export function decodeVinYear(vin) {
  if (vin.length !== 17) return null;

  const yearChar = vin.charAt(9).toUpperCase();
  const decadeChar = vin.charAt(6);

  const yearMap = {
    A: 1980,
    B: 1981,
    C: 1982,
    D: 1983,
    E: 1984,
    F: 1985,
    G: 1986,
    H: 1987,
    J: 1988,
    K: 1989,
    L: 1990,
    M: 1991,
    N: 1992,
    P: 1993,
    R: 1994,
    S: 1995,
    T: 1996,
    V: 1997,
    W: 1998,
    X: 1999,
    Y: 2000,
    "1": 2001,
    "2": 2002,
    "3": 2003,
    "4": 2004,
    "5": 2005,
    "6": 2006,
    "7": 2007,
    "8": 2008,
    "9": 2009,
  };

  let baseYear = yearMap[yearChar];
  if (!baseYear) return null;

  // Cycle Check: If the 7th digit is alphabetic, the vehicle belongs to the 2010-2039 cycle.
  if (/[A-Z]/i.test(decadeChar)) {
    baseYear += 30;
  }

  return baseYear;
}
