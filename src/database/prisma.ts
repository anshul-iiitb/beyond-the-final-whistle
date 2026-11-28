// @ts-nocheck
import 'dotenv/config';
import { PrismaClient } from '../../generated/prisma/client/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const connectionString = process.env.DATABASE_URL || 'postgres://localhost:5432/defaultdb';

// Optimized for Aiven Starter / Cloud PostgreSQL (preventing OOM & connection saturation)
const pool = new pg.Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
  max: 3,                          // Capped at 3 connections (well below Aiven 20 limit, preventing backend process RAM bloat)
  min: 1,                          // Maintain 1 warm connection for instant queries
  idleTimeoutMillis: 10000,        // Release idle connections after 10s to free RAM
  connectionTimeoutMillis: 5000,   // 5s connection timeout
  statement_timeout: 10000,        // Abort any query hanging over 10s to prevent memory accumulation
  application_name: 'btfw-bot',
});

pool.on('error', (err) => {
  console.warn('Unexpected error on idle pg pool for BTFW', err);
});

const adapter = new PrismaPg(pool);

export const prisma = new PrismaClient({
  adapter,
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
});
