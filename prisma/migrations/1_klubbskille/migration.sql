-- Klubbskille (2026-10-18): slug på klubb, adminbrukere og klubbadmins,
-- og serienavn unike per klubb. Skrevet for hånd slik at slug fylles ut
-- for eksisterende klubber FØR kolonnen blir påkrevd - ellers ville
-- migreringen feilet mot en database som allerede har klubber.

-- 1) slug: først valgfri, så utfylt, så påkrevd og unik.
ALTER TABLE "Klubb" ADD COLUMN "slug" TEXT;

-- Finnes det bare én klubb, er det Sinsen (alle data før klubbskillet
-- hørte til Sinsen). Ellers lages slug av navnet: små bokstaver, æøå
-- forenklet, alt annet enn a-z og 0-9 blir bindestrek.
UPDATE "Klubb" SET "slug" = 'sinsen'
WHERE (SELECT COUNT(*) FROM "Klubb") = 1;

UPDATE "Klubb"
SET "slug" = trim(BOTH '-' FROM regexp_replace(
  translate(lower("navn"), 'æøåäöü', 'aoaaou'), '[^a-z0-9]+', '-', 'g'))
WHERE "slug" IS NULL;

ALTER TABLE "Klubb" ALTER COLUMN "slug" SET NOT NULL;
CREATE UNIQUE INDEX "Klubb_slug_key" ON "Klubb"("slug");

-- 2) Serienavn er unike innad i en klubb.
CREATE UNIQUE INDEX "Serie_klubbId_navn_key" ON "Serie"("klubbId", "navn");

-- 3) Adminbrukere og hvilke klubber de administrerer.
CREATE TABLE "AdminBruker" (
    "id" TEXT NOT NULL,
    "epost" TEXT NOT NULL,
    "passordHash" TEXT NOT NULL,
    "erSuperadmin" BOOLEAN NOT NULL DEFAULT false,
    "opprettet" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminBruker_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "KlubbAdmin" (
    "brukerId" TEXT NOT NULL,
    "klubbId" TEXT NOT NULL,
    "rolle" TEXT NOT NULL DEFAULT 'admin',
    "opprettet" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KlubbAdmin_pkey" PRIMARY KEY ("brukerId","klubbId")
);

CREATE UNIQUE INDEX "AdminBruker_epost_key" ON "AdminBruker"("epost");
CREATE INDEX "KlubbAdmin_klubbId_idx" ON "KlubbAdmin"("klubbId");

ALTER TABLE "KlubbAdmin" ADD CONSTRAINT "KlubbAdmin_brukerId_fkey" FOREIGN KEY ("brukerId") REFERENCES "AdminBruker"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KlubbAdmin" ADD CONSTRAINT "KlubbAdmin_klubbId_fkey" FOREIGN KEY ("klubbId") REFERENCES "Klubb"("id") ON DELETE CASCADE ON UPDATE CASCADE;
