import { NextResponse } from 'next/server';
import { getDb, initTables, getEnv } from '@/lib/db';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  const authCookie = request.cookies.get('auth')?.value;
  const { ADMIN_PASSWORD: adminPassword } = getEnv();
  
  if (!authCookie) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }

  // 验证是否为管理员或有效的临时密码
  await initTables();
  const db = getDb();
  let isAuthorized = authCookie === adminPassword;
  
  if (!isAuthorized) {
    const now = Date.now();
    const row = await db.execute({
      sql: `SELECT password FROM temp_passwords WHERE password = ? AND revoked = 0 AND (expireAt IS NULL OR expireAt > ?)`,
      args: [authCookie, now]
    });
    isAuthorized = row.rows.length > 0;
  }

  if (!isAuthorized) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }

  const categoriesResult = await db.execute(`SELECT id, name, parentId, sort, visible FROM categories ORDER BY sort ASC`);
  const linksResult = await db.execute(`SELECT id, title, url, desc, categoryId, sort FROM links ORDER BY sort ASC`);

  const categories = categoriesResult.rows.map(row => ({
    id: row.id,
    name: row.name,
    parentId: row.parentId,
    sort: row.sort,
    visible: Boolean(row.visible)
  }));

  const links = linksResult.rows.map(row => ({
    id: row.id,
    title: row.title,
    url: row.url,
    desc: row.desc,
    categoryId: row.categoryId,
    sort: row.sort
  }));

  return NextResponse.json({ categories, links });
}