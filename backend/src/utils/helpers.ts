export const sanitizeVin = (rawVin: string | undefined | null): string | null => {
  if (!rawVin) return null;
  const clean = String(rawVin)
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  return clean.length === 17 && !/[IQO]/.test(clean) ? clean : null;
};
