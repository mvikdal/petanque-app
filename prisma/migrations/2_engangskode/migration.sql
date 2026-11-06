-- Engangskode på e-post (2026-10-24): adminer logger inn med en kode som
-- sendes på e-post, ikke med passord. Passord-hashene slettes.

ALTER TABLE "AdminBruker" DROP COLUMN "passordHash";

CREATE TABLE "Innloggingskode" (
    "id" TEXT NOT NULL,
    "brukerId" TEXT NOT NULL,
    "kodeHash" TEXT NOT NULL,
    "gyldigTil" TIMESTAMP(3) NOT NULL,
    "antallFeil" INTEGER NOT NULL DEFAULT 0,
    "opprettet" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Innloggingskode_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Innloggingskode_brukerId_idx" ON "Innloggingskode"("brukerId");

ALTER TABLE "Innloggingskode" ADD CONSTRAINT "Innloggingskode_brukerId_fkey" FOREIGN KEY ("brukerId") REFERENCES "AdminBruker"("id") ON DELETE CASCADE ON UPDATE CASCADE;
