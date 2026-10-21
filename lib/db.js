import { createClient } from '@libsql/client/web';
import { getRequestContext } from '@cloudflare/next-on-pages';

let client = null;

// 统一的获取环境变量方法，兼容本地开发与 Cloudflare Edge 线上
export function getEnv() {
  try {
    const { env } = getRequestContext();
    return {
      TURSO_DATABASE_URL: env.TURSO_DATABASE_URL,
      TURSO_AUTH_TOKEN: env.TURSO_AUTH_TOKEN,
      ADMIN_PASSWORD: env.ADMIN_PASSWORD,
    };
  } catch (e) {
    // 回退到本地环境
    return {
      TURSO_DATABASE_URL: process.env.TURSO_DATABASE_URL,
      TURSO_AUTH_TOKEN: process.env.TURSO_AUTH_TOKEN,
      ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
    };
  }
}

export function getDb() {
  if (!client) {
    const { TURSO_DATABASE_URL, TURSO_AUTH_TOKEN } = getEnv();
    if (!TURSO_DATABASE_URL) throw new Error('TURSO_DATABASE_URL is not set');
    client = createClient({ url: TURSO_DATABASE_URL, authToken: TURSO_AUTH_TOKEN });
  }
  return client;
}

let initPromise = null;

export function initTables() {
  if (!initPromise) {
    initPromise = performInit().catch(err => {
      initPromise = null;
      throw err;
    });
  }
  return initPromise;
}

async function performInit() {
  const db = getDb();
  await db.execute(`
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      parentId TEXT,
      sort INTEGER DEFAULT 0,
      visible INTEGER DEFAULT 1
    )
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS links (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      url TEXT NOT NULL,
      desc TEXT,
      categoryId TEXT NOT NULL,
      sort INTEGER DEFAULT 0
    )
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS temp_passwords (
      password TEXT PRIMARY KEY,
      createdAt INTEGER NOT NULL,
      expireAt INTEGER,
      durationSeconds INTEGER,
      revoked INTEGER DEFAULT 0
    )
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS login_fails (
      ip TEXT PRIMARY KEY,
      count INTEGER DEFAULT 0,
      lockedUntil INTEGER
    )
  `);
}