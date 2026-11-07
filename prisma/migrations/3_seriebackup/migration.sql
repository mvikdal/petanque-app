-- Sikkerhetskopi per serie (2026-11-07). Den nattlige jobben tar kopi av
-- serier der sistEndret er nyere enn sistBackup.

ALTER TABLE "Serie" ADD COLUMN "sistBackup" TIMESTAMP(3),
ADD COLUMN "sistEndret" TIMESTAMP(3);

-- Alle eksisterende serier regnes som endret, så de får sin første kopi
-- den første natten.
UPDATE "Serie" SET "sistEndret" = CURRENT_TIMESTAMP;

CREATE TABLE "SerieBackup" (
    "id" TEXT NOT NULL,
    "serieId" TEXT NOT NULL,
    "klubbId" TEXT NOT NULL,
    "serienavn" TEXT NOT NULL,
    "grunn" TEXT NOT NULL,
    "antallRunder" INTEGER NOT NULL,
    "antallSpillere" INTEGER NOT NULL,
    "data" TEXT NOT NULL,
    "opprettet" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SerieBackup_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SerieBackup_serieId_opprettet_idx" ON "SerieBackup"("serieId", "opprettet");

CREATE INDEX "SerieBackup_klubbId_idx" ON "SerieBackup"("klubbId");
