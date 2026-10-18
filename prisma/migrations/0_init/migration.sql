-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Spiller" (
    "id" TEXT NOT NULL,
    "navn" TEXT NOT NULL,
    "serieId" TEXT NOT NULL,
    "opprettet" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Spiller_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Klubb" (
    "id" TEXT NOT NULL,
    "navn" TEXT NOT NULL,
    "opprettet" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Klubb_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Serie" (
    "id" TEXT NOT NULL,
    "navn" TEXT NOT NULL,
    "ukedager" TEXT NOT NULL,
    "sesongStart" TIMESTAMP(3) NOT NULL,
    "sesongSlutt" TIMESTAMP(3),
    "poengGrense" INTEGER NOT NULL DEFAULT 13,
    "antallTellendeRunder" INTEGER NOT NULL DEFAULT 12,
    "status" TEXT NOT NULL DEFAULT 'aktiv',
    "opprettet" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "klubbId" TEXT NOT NULL,

    CONSTRAINT "Serie_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Runde" (
    "id" TEXT NOT NULL,
    "serieId" TEXT NOT NULL,
    "dato" TIMESTAMP(3) NOT NULL,
    "rundenummer" INTEGER NOT NULL,
    "opprettet" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Runde_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RundeEndring" (
    "id" TEXT NOT NULL,
    "rundeId" TEXT NOT NULL,
    "tidspunkt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kommentar" TEXT,
    "forrigeData" TEXT NOT NULL,

    CONSTRAINT "RundeEndring_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deltakelse" (
    "id" TEXT NOT NULL,
    "spillerId" TEXT NOT NULL,
    "rundeId" TEXT NOT NULL,
    "kamp1" INTEGER,
    "kamp2" INTEGER,
    "kamp3" INTEGER,

    CONSTRAINT "Deltakelse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Spiller_serieId_navn_key" ON "Spiller"("serieId", "navn");

-- CreateIndex
CREATE UNIQUE INDEX "Klubb_navn_key" ON "Klubb"("navn");

-- CreateIndex
CREATE UNIQUE INDEX "Runde_serieId_rundenummer_key" ON "Runde"("serieId", "rundenummer");

-- CreateIndex
CREATE INDEX "RundeEndring_rundeId_idx" ON "RundeEndring"("rundeId");

-- CreateIndex
CREATE UNIQUE INDEX "Deltakelse_spillerId_rundeId_key" ON "Deltakelse"("spillerId", "rundeId");

-- AddForeignKey
ALTER TABLE "Spiller" ADD CONSTRAINT "Spiller_serieId_fkey" FOREIGN KEY ("serieId") REFERENCES "Serie"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Serie" ADD CONSTRAINT "Serie_klubbId_fkey" FOREIGN KEY ("klubbId") REFERENCES "Klubb"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Runde" ADD CONSTRAINT "Runde_serieId_fkey" FOREIGN KEY ("serieId") REFERENCES "Serie"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RundeEndring" ADD CONSTRAINT "RundeEndring_rundeId_fkey" FOREIGN KEY ("rundeId") REFERENCES "Runde"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deltakelse" ADD CONSTRAINT "Deltakelse_spillerId_fkey" FOREIGN KEY ("spillerId") REFERENCES "Spiller"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deltakelse" ADD CONSTRAINT "Deltakelse_rundeId_fkey" FOREIGN KEY ("rundeId") REFERENCES "Runde"("id") ON DELETE CASCADE ON UPDATE CASCADE;
