-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "referralUrl" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "data_sources" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "recruitmentType" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "data_sources_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "jobs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "uniqueKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT,
    "locations" JSONB NOT NULL,
    "descriptionHtml" TEXT,
    "descriptionText" TEXT,
    "officialUrl" TEXT NOT NULL,
    "publishTime" DATETIME,
    "firstSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "contentHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "jobs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "jobs_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "data_sources" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "companies_slug_key" ON "companies"("slug");

-- CreateIndex
CREATE INDEX "data_sources_companyId_idx" ON "data_sources"("companyId");

-- CreateIndex
CREATE INDEX "data_sources_sourceType_idx" ON "data_sources"("sourceType");

-- CreateIndex
CREATE UNIQUE INDEX "jobs_uniqueKey_key" ON "jobs"("uniqueKey");

-- CreateIndex
CREATE INDEX "jobs_companyId_isActive_idx" ON "jobs"("companyId", "isActive");

-- CreateIndex
CREATE INDEX "jobs_sourceId_isActive_idx" ON "jobs"("sourceId", "isActive");

-- CreateIndex
CREATE INDEX "jobs_publishTime_idx" ON "jobs"("publishTime");
