import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function buildDatabaseUrl(): string {
  const url = process.env.DATABASE_URL ?? "";
  if (!url) return url;

  // Strip any existing pool params so we always control them here
  const stripped = url.replace(/[&?](connection_limit|pool_timeout)=[^&]*/g, "");
  const sep = stripped.includes("?") ? "&" : "?";

  // Serverless (Vercel): each function instance only needs 1 connection.
  // Using connection_limit=1 avoids exhausting the DB pool when many
  // function instances run in parallel. pool_timeout=10 fails fast
  // instead of hanging for 20s and returning a 500.
  const isServerless = process.env.VERCEL === "1" || process.env.NODE_ENV === "production";
  const limit = isServerless ? 1 : 5;
  const timeout = isServerless ? 10 : 20;

  return `${stripped}${sep}connection_limit=${limit}&pool_timeout=${timeout}`;
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: { db: { url: buildDatabaseUrl() } },
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
