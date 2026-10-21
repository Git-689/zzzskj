import { NextResponse } from 'next/server';
import { getDb, initTables, getEnv } from '@/lib/db';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

function verifyAuth(request) {
  const authCookie = request.cookies.get('auth')?.value;
  const { ADMIN_PASSWORD } = getEnv();
  return authCookie === ADMIN_PASSWORD;
}

async function cleanExpired(db) {
  const now = Date.now();
  await db.execute({
    sql: `DELETE FROM temp_passwords WHERE revoked = 1 OR (expireAt IS NOT NULL AND expireAt < ?)`,
    args: [now]
  });
}

export async function POST(request) {
  if (!verifyAuth(request)) return NextResponse.json({ error: '未授权' }, { status: 401 });
  await initTables();

  const { durationSeconds } = await request.json();
  const db = getDb();
  
  // 防止极小概率的密码冲突
  let password;
  let isUnique = false;
  for (let i = 0; i < 5; i++) {
    password = Math.floor(100000 + Math.random() * 900000).toString();
    const check = await db.execute({ sql: `SELECT password FROM temp_passwords WHERE password = ?`, args: [password] });
    if (check.rows.length === 0) { isUnique = true; break; }
  }
  if (!isUnique) {
    return NextResponse.json({ error: '密码生成冲突，请重试' }, { status: 500 });
  }

  const createdAt = Date.now();
  const expireAt = durationSeconds === -1 ? null : createdAt + durationSeconds * 1000;

  await db.execute({
    sql: `INSERT INTO temp_passwords (password, createdAt, expireAt, durationSeconds, revoked) VALUES (?, ?, ?, ?, 0)`,
    args: [password, createdAt, expireAt, durationSeconds]
  });

  await cleanExpired(db);
  return NextResponse.json({ password, createdAt, expireAt });
}

export async function GET(request) {
  if (!verifyAuth(request)) return NextResponse.json({ error: '未授权' }, { status: 401 });
  await initTables();

  const db = getDb();
  const now = Date.now();
  const rows = await db.execute(`SELECT password, createdAt, expireAt, durationSeconds, revoked FROM temp_passwords ORDER BY createdAt DESC LIMIT 50`);

  const list = rows.rows.map(row => {
    let status;
    if (row.revoked) status = 'expired';
    else if (row.expireAt === null) status = 'forever';
    else if (now < row.expireAt) status = 'active';
    else status = 'expired';
    return { password: row.password, createdAt: row.createdAt, expireAt: row.expireAt, durationSeconds: row.durationSeconds, status };
  });

  return NextResponse.json(list);
}

export async function DELETE(request) {
  if (!verifyAuth(request)) return NextResponse.json({ error: '未授权' }, { status: 401 });
  await initTables();

  const { searchParams } = new URL(request.url);
  const password = searchParams.get('password');
  if (!password) return NextResponse.json({ error: '参数缺失' }, { status: 400 });

  const db = getDb();
  await db.execute({ sql: `UPDATE temp_passwords SET revoked = 1 WHERE password = ?`, args: [password] });

  return NextResponse.json({ success: true });
}