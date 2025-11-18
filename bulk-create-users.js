const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

// 환경 변수에서 DB 정보 가져오기
const dbConfig = {
  host: process.env.MYSQL_HOST || process.env.DB_HOST || 'localhost',
  port: Number(process.env.MYSQL_PORT || process.env.DB_PORT) || 3306,
  user: process.env.MYSQL_USER || process.env.DB_USER || 'root',
  password: process.env.MYSQL_PASSWORD || process.env.DB_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || process.env.DB_NAME || 'attendance',
};

async function createUsersFromCSV() {
  let connection;

  try {
    // DB 연결
    connection = await mysql.createConnection(dbConfig);

    // CSV 파일 읽기
    const csvPath = path.join(__dirname, '../Downloads/상담사들.csv');
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
    const hashedPassword = await bcrypt.hash(password, 10);

    // 사용자들 생성
    const currentYear = new Date().getFullYear();
    let successCount = 0;
    let skipCount = 0;

    for (const user of users) {
      try {
        // 중복 체크
        const [existing] = await connection.execute(
          'SELECT id FROM atnd_users WHERE username = ?',
          [user.username]
        );

        if (existing.length > 0) {
          console.log(`⚠️  사용자 ${user.name}(${user.username})는 이미 존재합니다. 건너뜀.`);
          skipCount++;
          continue;
        }

        // 사용자 생성
        const [result] = await connection.execute(
          `INSERT INTO atnd_users (username, password, name, department, role, is_temp_password)
           VALUES (?, ?, ?, ?, ?, 1)`,
          [user.username, hashedPassword, user.name, user.department, user.role]
        );

        const userId = result.insertId;

        // 연차/체휴 초기 데이터 생성
        await connection.execute(
          `INSERT INTO leave_balances (user_id, year, leave_type, total, used, remaining)
           VALUES (?, ?, 'annual', 15, 0, 15), (?, ?, 'compensatory', 0, 0, 0)`,
          [userId, currentYear, userId, currentYear]
        );

        console.log(`✅ 사용자 ${user.name}(${user.username}) 생성 완료`);
        successCount++;

      } catch (error) {
        console.error(`❌ 사용자 ${user.name}(${user.username}) 생성 실패:`, error.message);
      }
    }

    console.log(`\n📊 처리 결과:`);
    console.log(`✅ 성공: ${successCount}명`);
    console.log(`⚠️  건너뜀: ${skipCount}명`);
    console.log(`총 처리: ${successCount + skipCount}명`);

  } catch (error) {
    console.error('스크립트 실행 중 오류 발생:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// 스크립트 실행
createUsersFromCSV().catch(console.error);
