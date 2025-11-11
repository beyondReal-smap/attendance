import { NextRequest, NextResponse } from 'next/server';
import { loginUser, createSession } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: '아이디와 비밀번호를 입력하세요.' },
        { status: 400 }
      );
    }

    const session = await loginUser(username, password);

    if (!session) {
      return NextResponse.json(
        { error: '아이디 또는 비밀번호가 올바르지 않습니다.' },
        { status: 401 }
      );
    }

    await createSession(session.userId, session.username, session.name, session.isAdmin);

    // 임시 비밀번호(4자리 숫자)인지 확인
    const isTempPassword = /^\d{4}$/.test(password);

    return NextResponse.json({
      success: true,
      isTempPassword
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: '로그인 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

