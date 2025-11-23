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

    // DB에서 데이터 가져오기
    // DB에서 데이터 가져오기
    const users = await sql`
      SELECT id, name, department, username, role
      FROM atnd_users
      LIMIT 20
    `;

    const leaveBalances = await sql`
      SELECT user_id, year, leave_type, total, used, remaining
      FROM leave_balances
    `;

    const attendances = await sql`
      SELECT user_id, date, type, reason, start_time, end_time
      FROM atnd_attendance
      ORDER BY date DESC
      LIMIT 50
    `;

    // 데이터 조합 (user_id 기준)
    const aggregatedData = users.rows.map((user: any) => {
      const userLeaveBalances = leaveBalances.rows.filter((lb: any) => lb.user_id === user.id);
      const userAttendances = attendances.rows.filter((a: any) => a.user_id === user.id);

      return {
        ...user,
        leave_balances: userLeaveBalances,
        attendance_history: userAttendances
      };
    });

    console.log(aggregatedData);

    const systemPrompt = `
      당신은 근태 관리 시스템의 AI 어시스턴트입니다.
      다음은 현재 시스템의 데이터입니다. 각 사용자의 정보와 연차/체휴 현황, 그리고 근태 기록이 포함되어 있습니다.
      이 데이터를 바탕으로 사용자의 질문에 답변해주세요.
      
      데이터:
      ${JSON.stringify(aggregatedData, (key, value) =>
      typeof value === 'bigint' ? value.toString() : value
      , 2)}
    `;

    try {
      const result = await streamText({
        // model: 'meituan/longcat-flash-chat',
        model: 'google/gemini-2.5-flash-lite',
        // model: 'google/gemini-1.5-flash',
        system: systemPrompt,
        prompt: message,
      });

      // 스트리밍 응답을 위한 ReadableStream 생성
      const stream = new ReadableStream({
        async start(controller) {
          try {
            let fullResponse = '';

            for await (const textPart of result.textStream) {
              fullResponse += textPart;
              // 각 토큰을 JSON 형태로 전송
              const data = JSON.stringify({
                type: 'token',
                content: textPart,
                fullResponse: fullResponse
              }) + '\n';
              controller.enqueue(new TextEncoder().encode(data));
            }

            // 완료 신호 전송
            const completionData = JSON.stringify({
              type: 'complete',
              fullResponse: fullResponse,
              usage: await result.usage,
              finishReason: result.finishReason
            }) + '\n';
            controller.enqueue(new TextEncoder().encode(completionData));

            // DB에 채팅 로그 저장
            try {
              await sql`
                INSERT INTO ai_chat_logs (user_id, user_message, ai_response)
                VALUES (${parseInt(session.userId)}, ${message}, ${fullResponse})
              `;
            } catch (dbError) {
              console.error('DB 저장 오류:', dbError);
            }

          } catch (streamError: any) {
            console.error('스트리밍 오류:', streamError);
            const errorMessage = streamError.message || '스트리밍 중 알 수 없는 오류가 발생했습니다.';
            const errorData = JSON.stringify({
              type: 'error',
              error: `스트리밍 오류: ${errorMessage}`
            }) + '\n';
            controller.enqueue(new TextEncoder().encode(errorData));
          } finally {
            controller.close();
          }
        }
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });

    } catch (aiError) {
      console.error('AI Gateway 오류:', aiError);

      // 로컬 환경에서는 AI Gateway가 작동하지 않을 수 있음
      if (process.env.NODE_ENV === 'development') {
        const fallbackResponse = `안녕하세요! 저는 AI 어시스턴트입니다. 현재 로컬 개발 환경에서는 AI Gateway가 제한적으로 작동할 수 있습니다.\n\n귀하의 질문: "${message}"\n\n프로덕션 환경(Vercel 배포)에서는 정상적으로 작동합니다.`;

        // DB에 채팅 로그 저장
        try {
          await sql`
            INSERT INTO ai_chat_logs (user_id, user_message, ai_response)
            VALUES (${parseInt(session.userId)}, ${message}, ${fallbackResponse})
          `;
        } catch (dbError) {
          console.error('DB 저장 오류:', dbError);
        }

        return NextResponse.json({
          response: fallbackResponse,
          usage: null,
          finishReason: 'completed',
        });
      } else {
        throw aiError; // 프로덕션에서는 에러를 다시 던짐
      }
    }

  } catch (error) {
    console.error('AI Chat API error:', error);
    return NextResponse.json(
      { error: 'AI 응답 생성 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
