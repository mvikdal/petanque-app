// Alle URL-er til klubbinnhold starter med klubbens slug (/sinsen/...).
// Samles her, så stiene ikke spres som strenger rundt i koden.
export const klubbUrl = (slug: string) => `/${slug}`;
export const serieUrl = (slug: string, serieId: string) => `/${slug}/serie/${serieId}`;
export const rundeUrl = (slug: string, serieId: string, rundeId: string) =>
  `/${slug}/serie/${serieId}/runde/${rundeId}`;

export const adminUrl = (slug: string) => `/${slug}/admin`;
export const adminGuideUrl = (slug: string) => `/${slug}/admin/guide`;
export const adminNyRundeUrl = (slug: string, serieId: string) =>
  `/${slug}/admin/serie/${serieId}/ny-runde`;
export const adminRunderUrl = (slug: string, serieId: string) =>
  `/${slug}/admin/serie/${serieId}/runder`;
export const adminRedigerSerieUrl = (slug: string, serieId: string) =>
  `/${slug}/admin/serie/${serieId}/rediger`;
export const adminRedigerRundeUrl = (slug: string, serieId: string, rundeId: string) =>
  `/${slug}/admin/serie/${serieId}/runde/${rundeId}/rediger`;
export const adminKontoUrl = (slug: string) => `/${slug}/admin/konto`;
