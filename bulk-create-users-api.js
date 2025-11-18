const fs = require('fs');
const path = require('path');

// CSV 파일 읽기
function readCSV() {
  const csvPath = '/Users/genie/Downloads/상담사들.csv';
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
        role: role && role.trim() === '중간관리자' ? 'manager' : 'user',
        password: '1234'
      });
    }
  }

  return users;
}

// 관리자로 로그인
async function loginAsAdmin() {
  try {
    const response = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: 'admin',
        password: 'admin123'
      })
    });

    const result = await response.json();

    if (response.ok) {
      console.log('✅ 관리자 로그인 성공');
      // 쿠키 저장
      const cookies = response.headers.get('set-cookie');
      return cookies;
    } else {
      console.log(`❌ 관리자 로그인 실패: ${result.error}`);
      return null;
    }
  } catch (error) {
    console.error('❌ 관리자 로그인 API 호출 실패:', error.message);
    return null;
  }
}

// API를 통해 사용자 생성
async function createUserViaAPI(user, cookies) {
  try {
    const response = await fetch('http://localhost:3000/api/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookies || ''
      },
      body: JSON.stringify(user)
    });

    const result = await response.json();

    if (response.ok) {
      console.log(`✅ 사용자 ${user.name}(${user.username}) 생성 완료`);
      return true;
    } else {
      console.log(`❌ 사용자 ${user.name}(${user.username}) 생성 실패: ${result.error}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ 사용자 ${user.name}(${user.username}) API 호출 실패:`, error.message);
    return false;
  }
}

async function main() {
  console.log('CSV 데이터 읽는 중...');
  const users = readCSV();
  console.log(`총 ${users.length}명의 사용자 데이터를 발견했습니다.`);

  console.log('\n관리자 로그인 중...');
  const cookies = await loginAsAdmin();

  if (!cookies) {
    console.error('관리자 로그인에 실패하여 사용자 생성을 중단합니다.');
    return;
  }

  let successCount = 0;
  let failCount = 0;

  console.log('\n사용자 생성 시작...');

  // 순차적으로 생성 (병렬로 하면 DB 부하가 걸릴 수 있음)
  for (const user of users) {
    const success = await createUserViaAPI(user, cookies);
    if (success) {
      successCount++;
    } else {
      failCount++;
    }

    // 너무 빠른 요청 방지
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  console.log(`\n📊 처리 결과:`);
  console.log(`✅ 성공: ${successCount}명`);
  console.log(`❌ 실패: ${failCount}명`);
  console.log(`총 처리: ${successCount + failCount}명`);
}

main().catch(console.error);
