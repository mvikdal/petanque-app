-- CreateTable
CREATE TABLE "Spiller" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "navn" TEXT NOT NULL,
    "opprettet" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Serie" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "navn" TEXT NOT NULL,
    "ukedager" TEXT NOT NULL,
    "sesongStart" DATETIME NOT NULL,
    "sesongSlutt" DATETIME,
    "poengGrense" INTEGER NOT NULL DEFAULT 13,
    "antallTellendeRunder" INTEGER NOT NULL DEFAULT 12,
    "status" TEXT NOT NULL DEFAULT 'aktiv',
    "opprettet" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Runde" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "serieId" TEXT NOT NULL,
    "dato" DATETIME NOT NULL,
    "rundenummer" INTEGER NOT NULL,
    "opprettet" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Runde_serieId_fkey" FOREIGN KEY ("serieId") REFERENCES "Serie" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Deltakelse" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "spillerId" TEXT NOT NULL,
    "rundeId" TEXT NOT NULL,
    "kamp1" INTEGER NOT NULL,
    "kamp2" INTEGER NOT NULL,
    "kamp3" INTEGER NOT NULL,
    CONSTRAINT "Deltakelse_spillerId_fkey" FOREIGN KEY ("spillerId") REFERENCES "Spiller" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Deltakelse_rundeId_fkey" FOREIGN KEY ("rundeId") REFERENCES "Runde" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Runde_serieId_rundenummer_key" ON "Runde"("serieId", "rundenummer");

-- CreateIndex
CREATE UNIQUE INDEX "Deltakelse_spillerId_rundeId_key" ON "Deltakelse"("spillerId", "rundeId");
