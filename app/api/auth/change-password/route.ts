import { NextResponse } from 'next/server';
import { getSession, hashPassword, createSession } from '@/lib/auth';
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

    // 비밀번호 업데이트 및 임시비밀번호 플래그 초기화
    await sql`
      UPDATE atnd_users
      SET password = ${hashedPassword}, is_temp_password = 0
      WHERE id = ${session.userId}
    `;

    // 세션 업데이트 (임시비밀번호 플래그 제거)
    await createSession(session.userId, session.username, session.name, session.department, session.isAdmin, session.role, false);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error changing password:', error);
    return NextResponse.json(
      { error: '비밀번호 변경에 실패했습니다.' },
      { status: 500 }
    );
  }
}
