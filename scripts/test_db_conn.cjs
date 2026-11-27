const dotenv = require('dotenv');
dotenv.config();

const { PrismaClient } = require('../generated/prisma/client/client.js');
const { PrismaPg } = require('@prisma/adapter-pg');
const pg = require('pg');

async function test() {
  console.log('Connecting to DATABASE_URL:', process.env.DATABASE_URL ? process.env.DATABASE_URL.replace(/:[^:@]+@/, ':***@') : 'NONE');
  
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 2,
    connectionTimeoutMillis: 5000,
  });

  try {
    const client = await pool.connect();
    console.log('PG pool.connect() succeeded!');
    const res = await client.query('SELECT 1 as num');
    console.log('Query SELECT 1 result:', res.rows);
    client.release();
  } catch (err) {
    console.error('PG connect error:', err);
  }

  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    const players = await prisma.player.findMany({ take: 1 });
    console.log('Prisma player.findMany() succeeded! Count:', players.length);
  } catch (err) {
    console.error('Prisma query error:', err);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

test();
