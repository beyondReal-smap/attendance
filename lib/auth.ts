import { cookies } from 'next/headers';
import { Session } from '@/types';
import bcrypt from 'bcryptjs';
import { sql } from '@vercel/postgres';

export async function createSession(userId: string, username: string, name: string, isAdmin: boolean) {
  const session: Session = { userId, username, name, isAdmin };
  const cookieStore = await cookies();
  cookieStore.set('session', JSON.stringify(session), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7일
  });
}

export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('session');
  
  if (!sessionCookie) {
    return null;
  }

  try {
    return JSON.parse(sessionCookie.value) as Session;
  } catch {
    return null;
  }
}

export async function deleteSession() {
  const cookieStore = await cookies();
  cookieStore.delete('session');
}

export async function verifyPassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(plainPassword, hashedPassword);
}

export async function loginUser(username: string, password: string): Promise<Session | null> {
  try {
    const result = await sql`
      SELECT id, username, password, name, is_admin
      FROM users
      WHERE username = ${username}
    `;

    if (result.rows.length === 0) {
      return null;
    }

    const user = result.rows[0];
    const isValid = await verifyPassword(password, user.password);

    if (!isValid) {
      return null;
    }

    return {
      userId: user.id.toString(),
      username: user.username,
      name: user.name,
      isAdmin: user.is_admin,
    };
  } catch (error) {
    console.error('Login error:', error);
    return null;
  }
}

