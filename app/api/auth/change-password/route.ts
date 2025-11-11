import { NextResponse } from 'next/server';
import { getSession, hashPassword } from '@/lib/auth';
import { sql } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { newPassword } = await request.json();

    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json({ error: '비밀번호는 최소 6자리 이상이어야 합니다.' }, { status: 400 });
    }

    // 새 비밀번호 해시
    const hashedPassword = await hashPassword(newPassword);

    // 비밀번호 업데이트
    await sql`
      UPDATE atnd_users
      SET password = ${hashedPassword}
      WHERE id = ${session.userId}
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error changing password:', error);
    return NextResponse.json(
      { error: '비밀번호 변경에 실패했습니다.' },
      { status: 500 }
    );
  }
}
