// src/lib/prisma.js
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis;

const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ["warn", "error"], // add 'query' if you need
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export default prisma;
