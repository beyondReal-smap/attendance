import { NextRequest, NextResponse } from 'next/server';
import { streamText } from 'ai';
import { getSession } from '@/lib/auth';
import { sql } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    // 세션 확인
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    const { message } = await request.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: '메시지가 필요합니다.' },
        { status: 400 }
      );
    }

    let fullResponse = '';

    try {
      const result = await streamText({
        model: 'meituan/longcat-flash-chat',
        prompt: message,
      });

      // 스트림을 텍스트로 변환
      for await (const textPart of result.textStream) {
        fullResponse += textPart;
      }
    } catch (aiError) {
      console.error('AI Gateway 오류:', aiError);

      // 로컬 환경에서는 AI Gateway가 작동하지 않을 수 있음
      if (process.env.NODE_ENV === 'development') {
        fullResponse = `안녕하세요! 저는 AI 어시스턴트입니다. 현재 로컬 개발 환경에서는 AI Gateway가 제한적으로 작동할 수 있습니다.\n\n귀하의 질문: "${message}"\n\n프로덕션 환경(Vercel 배포)에서는 정상적으로 작동합니다.`;
      } else {
        throw aiError; // 프로덕션에서는 에러를 다시 던짐
      }
    }

    // DB에 채팅 로그 저장
    try {
      await sql`
        INSERT INTO ai_chat_logs (user_id, user_message, ai_response)
        VALUES (${parseInt(session.userId)}, ${message}, ${fullResponse})
      `;
    } catch (dbError) {
      console.error('DB 저장 오류:', dbError);
      // DB 오류가 있어도 AI 응답은 반환
    }

    return NextResponse.json({
      response: fullResponse,
      usage: null, // 로컬에서는 usage 정보가 없을 수 있음
      finishReason: 'completed',
    });

  } catch (error) {
    console.error('AI Chat API error:', error);
    return NextResponse.json(
      { error: 'AI 응답 생성 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
