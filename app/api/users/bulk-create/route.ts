import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession, hashPassword } from '@/lib/auth';
import fs from 'fs';
import path from 'path';

export async function POST() {
  try {
    // 관리자 권한 확인
    const session = await getSession();
    if (!session || !session.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // CSV 파일 읽기
    const csvPath = '/Users/genie/Downloads/상담사들.csv';

    if (!fs.existsSync(csvPath)) {
      return NextResponse.json({ error: 'CSV 파일을 찾을 수 없습니다.' }, { status: 404 });
    }

    const csvData = fs.readFileSync(csvPath, 'utf-8');

    // CSV 파싱 (헤더 제외)
    const lines = csvData.trim().split('\n').slice(1);
    const users = [];

    for (const line of lines) {
      const [department, username, name, role] = line.split(',');
      if (username && name) {
        users.push({
          username: username.trim(),
          name: name.trim(),
          department: department.trim(),
          role: role && role.trim() === '중간관리자' ? 'manager' : 'user'
        });
      }
    }

    console.log(`총 ${users.length}명의 사용자 데이터를 발견했습니다.`);

    // 비밀번호 해시화
    const password = '1234';
    const hashedPassword = await hashPassword(password);

    // 사용자들 생성
    const currentYear = new Date().getFullYear();
    let successCount = 0;
    let skipCount = 0;
    const createdUsers = [];

    for (const user of users) {
      try {
        // 중복 체크
        const existing = await sql`
          SELECT id FROM atnd_users WHERE username = ${user.username}
        `;

        if (existing.rows.length > 0) {
          skipCount++;
          continue;
        }

        // 사용자 생성
        await sql`
          INSERT INTO atnd_users (username, password, name, department, role, is_temp_password)
          VALUES (${user.username}, ${hashedPassword}, ${user.name}, ${user.department}, ${user.role}, 1)
        `;

        // 새로 생성된 사용자의 ID 가져오기
        const userResult = await sql`
          SELECT id FROM atnd_users WHERE username = ${user.username}
        `;
        const userId = userResult.rows[0].id;

        // 연차/체휴 초기 데이터 생성
        await sql`
          INSERT INTO leave_balances (user_id, year, leave_type, total, used, remaining)
          VALUES
            (${userId}, ${currentYear}, 'annual', 15, 0, 15),
            (${userId}, ${currentYear}, 'compensatory', 0, 0, 0)
        `;

        createdUsers.push({
          id: userId.toString(),
          username: user.username,
          name: user.name,
          department: user.department,
          role: user.role
        });

        successCount++;

      } catch (error) {
        console.error(`사용자 ${user.name}(${user.username}) 생성 실패:`, error);
      }
    }

    return NextResponse.json({
      success: true,
      message: `${successCount}명의 사용자를 생성했습니다. ${skipCount}명의 사용자는 이미 존재하여 건너뛰었습니다.`,
      createdUsers,
      stats: {
        total: users.length,
        success: successCount,
        skipped: skipCount
      }
    });

  } catch (error) {
    console.error('Bulk user creation error:', error);
    return NextResponse.json(
      { error: '사용자 벌크 생성 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
