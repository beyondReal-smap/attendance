import { NextRequest, NextResponse } from 'next/server';
import { streamText } from 'ai';

export async function POST(request: NextRequest) {
  try {
    const { message } = await request.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: '메시지가 필요합니다.' },
        { status: 400 }
      );
    }

    const result = await streamText({
      model: 'meituan/longcat-flash-chat',
      prompt: message,
    });

    // 스트림을 텍스트로 변환
    let fullResponse = '';
    for await (const textPart of result.textStream) {
      fullResponse += textPart;
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
