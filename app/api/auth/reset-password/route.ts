import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession, hashPassword } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    // 관리자 권한 확인
    const session = await getSession();
    if (!session || !session.isAdmin) {
      return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: '사용자 ID가 필요합니다.' }, { status: 400 });
    }

    // 새 비밀번호 생성 (4자리 숫자)
    const newPassword = Math.floor(1000 + Math.random() * 9000).toString();

    // 비밀번호 해싱
    const hashedPassword = await hashPassword(newPassword);

    // 사용자 비밀번호 업데이트
    await sql`
      UPDATE atnd_users
      SET password = ${hashedPassword}
      WHERE id = ${userId}
    `;

    return NextResponse.json({
      success: true,
      message: '비밀번호가 성공적으로 초기화되었습니다.',
      newPassword
    });

  } catch (error) {
    console.error('Password reset API error:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
