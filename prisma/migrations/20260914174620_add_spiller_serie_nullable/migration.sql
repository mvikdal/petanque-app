-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Spiller" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "navn" TEXT NOT NULL,
    "serieId" TEXT,
    "opprettet" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Spiller_serieId_fkey" FOREIGN KEY ("serieId") REFERENCES "Serie" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Spiller" ("id", "navn", "opprettet") SELECT "id", "navn", "opprettet" FROM "Spiller";
DROP TABLE "Spiller";
ALTER TABLE "new_Spiller" RENAME TO "Spiller";
CREATE INDEX "Spiller_serieId_idx" ON "Spiller"("serieId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
