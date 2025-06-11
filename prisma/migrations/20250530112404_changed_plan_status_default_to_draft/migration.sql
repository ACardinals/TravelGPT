-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_TravelPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "textContent" TEXT,
    "imageUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "feasibilityScore" REAL,
    "reasonablenessScore" REAL,
    "analysisDetails" JSONB,
    "suggestions" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TravelPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_TravelPlan" ("analysisDetails", "createdAt", "feasibilityScore", "id", "imageUrl", "reasonablenessScore", "status", "suggestions", "textContent", "title", "updatedAt", "userId") SELECT "analysisDetails", "createdAt", "feasibilityScore", "id", "imageUrl", "reasonablenessScore", "status", "suggestions", "textContent", "title", "updatedAt", "userId" FROM "TravelPlan";
DROP TABLE "TravelPlan";
ALTER TABLE "new_TravelPlan" RENAME TO "TravelPlan";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
