import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

type DatabaseEnvironment = {
  NODE_ENV?: string;
  DATABASE_URL?: string;
  DATABASE_URL_UNPOOLED?: string;
};

function databaseHostname(value: string) {
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    throw new Error("DATABASE_URL is not a valid PostgreSQL URL");
  }
}

export function assertPooledRuntimeDatabaseUrl(environment: DatabaseEnvironment = process.env) {
  const runtimeUrl = environment.DATABASE_URL;
  if (!runtimeUrl || environment.NODE_ENV !== "production") return;

  const runtimeHost = databaseHostname(runtimeUrl);
  if (!runtimeHost.endsWith(".neon.tech")) return;

  const directUrl = environment.DATABASE_URL_UNPOOLED;
  if (directUrl && runtimeHost === databaseHostname(directUrl)) {
    throw new Error("DATABASE_URL must use the pooled endpoint; reserve DATABASE_URL_UNPOOLED for migrations");
  }
  if (runtimeHost.endsWith(".neon.tech") && !runtimeHost.includes("-pooler.")) {
    throw new Error("Production Neon DATABASE_URL must use a pooler hostname");
  }
}

export function getPrismaClient() {
  assertPooledRuntimeDatabaseUrl();
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = new PrismaClient();
  }
  return globalForPrisma.prisma;
}

export const prisma = getPrismaClient();
