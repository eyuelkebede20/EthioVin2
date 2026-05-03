// src/utils/vinParser.ts

export interface ParsedISO {
  isValid: boolean;
  type: "ISO";
  originalInput: string;
  wmi?: string;
  vds?: string;
  vis?: string;
  yearChar?: string;
  possibleYears?: number[];
  plantCode?: string;
  region?: "US" | "Asia" | "Europe" | "Other";
  error?: string;
}

export interface ParsedJDM {
  isValid: boolean;
  type: "JDM";
  originalInput: string;
  modelCode?: string;
  serialNumber?: string;
  error?: string;
}

export function parseISOVin(vin: string): ParsedISO {
  const normalizedVin = vin.toUpperCase().trim();

  // 1. Validate Length and Excluded Characters (I, O, Q)
  const isoRegex = /^[A-HJ-NPR-Z0-9]{17}$/;
  if (!isoRegex.test(normalizedVin)) {
    return {
      isValid: false,
      type: "ISO",
      originalInput: vin,
      error: "Invalid ISO VIN: Must be exactly 17 characters and cannot contain I, O, or Q.",
    };
  }

  // 2. Destructure
  const wmi = normalizedVin.slice(0, 3);
  const vds = normalizedVin.slice(3, 9);
  const vis = normalizedVin.slice(9, 17);
  const yearChar = normalizedVin.charAt(9);
  const possibleYears = decodeVinYear(yearChar) || [];
  const plantCode = normalizedVin.charAt(10);
  const regionChar = normalizedVin.charAt(0);

  // 3. Determine Region Heuristic
  let region: ParsedISO["region"] = "Other";
  if (["1", "4", "5"].includes(regionChar)) region = "US";
  else if (["J", "K"].includes(regionChar)) region = "Asia";
  else if (["W", "S", "V", "Z"].includes(regionChar)) region = "Europe";

  return {
    isValid: true,
    type: "ISO",
    originalInput: normalizedVin,
    wmi,
    vds,
    vis,
    yearChar,

    plantCode,
    region,
  };
}
// src/utils/vinParser.ts

const VIN_YEAR_MAP: Record<string, number[]> = {
  A: [1980, 2010],
  B: [1981, 2011],
  C: [1982, 2012],
  D: [1983, 2013],
  E: [1984, 2014],
  F: [1985, 2015],
  G: [1986, 2016],
  H: [1987, 2017],
  J: [1988, 2018],
  K: [1989, 2019],
  L: [1990, 2020],
  M: [1991, 2021],
  N: [1992, 2022],
  P: [1993, 2023],
  R: [1994, 2024],
  S: [1995, 2025],
  T: [1996, 2026],
  V: [1997, 2027],
  W: [1998, 2028],
  X: [1999, 2029],
  Y: [2000, 2030],
  "1": [2001, 2031],
  "2": [2002, 2032],
  "3": [2003, 2033],
  "4": [2004, 2034],
  "5": [2005, 2035],
  "6": [2006, 2036],
  "7": [2007, 2037],
  "8": [2008, 2038],
  "9": [2009, 2039],
};

export function decodeVinYear(yearChar: string): number[] | null {
  const char = yearChar.toUpperCase();
  return VIN_YEAR_MAP[char] || null;
}

export function parseJDMFrame(frameNumber: string): ParsedJDM {
  const normalizedFrame = frameNumber.toUpperCase().trim();

  // Validate JDM Format: alphanumeric model code, hyphen, numeric/alphanumeric serial
  const jdmRegex = /^[A-Z0-9]{3,10}-[A-Z0-9]{5,8}$/;
  if (!jdmRegex.test(normalizedFrame)) {
    return {
      isValid: false,
      type: "JDM",
      originalInput: frameNumber,
      error: "Invalid JDM Frame: Must follow the [Model Code]-[Serial] format.",
    };
  }

  const [modelCode, serialNumber] = normalizedFrame.split("-");

  return {
    isValid: true,
    type: "JDM",
    originalInput: normalizedFrame,
    modelCode,
    serialNumber,
  };
}
