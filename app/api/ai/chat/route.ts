import { NextRequest, NextResponse } from 'next/server';
import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';
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

    const result = await streamText({
      model: openai('gpt-4'),
      prompt: message,
    });

    // 스트림을 텍스트로 변환
    let fullResponse = '';
    for await (const textPart of result.textStream) {
      fullResponse += textPart;
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
      usage: await result.usage,
      finishReason: result.finishReason,
    });

  } catch (error) {
    console.error('AI Chat API error:', error);
    return NextResponse.json(
      { error: 'AI 응답 생성 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
