import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';

export default async function Home() {
  try {
    const session = await getSession();
    
    if (session) {
      redirect('/calendar');
    } else {
      redirect('/login');
    }
  } catch (error) {
    // 에러 발생 시 로그인 페이지로 리다이렉트
    redirect('/login');
  }
}
