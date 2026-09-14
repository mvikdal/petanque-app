-- CreateTable
CREATE TABLE "RundeEndring" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "rundeId" TEXT NOT NULL,
    "tidspunkt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kommentar" TEXT,
    "forrigeData" TEXT NOT NULL,
    CONSTRAINT "RundeEndring_rundeId_fkey" FOREIGN KEY ("rundeId") REFERENCES "Runde" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "RundeEndring_rundeId_idx" ON "RundeEndring"("rundeId");
