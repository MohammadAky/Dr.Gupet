-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Pharmacy" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "province" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "lat" REAL,
    "lng" REAL,
    "phone" TEXT,
    "workingHours" TEXT,
    "is24h" BOOLEAN NOT NULL DEFAULT false,
    "onDuty" BOOLEAN NOT NULL DEFAULT false,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true
);
INSERT INTO "new_Pharmacy" ("address", "city", "id", "is24h", "isActive", "isVerified", "lat", "lng", "name", "phone", "province", "workingHours") SELECT "address", "city", "id", "is24h", "isActive", "isVerified", "lat", "lng", "name", "phone", "province", "workingHours" FROM "Pharmacy";
DROP TABLE "Pharmacy";
ALTER TABLE "new_Pharmacy" RENAME TO "Pharmacy";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
