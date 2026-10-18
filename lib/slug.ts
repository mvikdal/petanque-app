// Klubbens slug er første del av alle klubbens URL-er (/sinsen/...).
// Ord som brukes av toppnivå-ruter kan ikke være slug.
export const RESERVERTE_SLUGGER = new Set([
  "admin",
  "superadmin",
  "serie",
  "api",
  "login",
  "_next",
]);

export function erGyldigSlug(slug: string): boolean {
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) && !RESERVERTE_SLUGGER.has(slug);
}
