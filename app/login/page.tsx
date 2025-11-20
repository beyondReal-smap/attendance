'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FiEye, FiEyeOff } from 'react-icons/fi';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // 비밀번호 변경 모달 상태
  const [showPasswordChangeModal, setShowPasswordChangeModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isTempPasswordUser, setIsTempPasswordUser] = useState(false);
  const [rememberUsername, setRememberUsername] = useState(false);

  // URL 파라미터 확인 및 저장된 사원번호 불러오기
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // URL 파라미터 확인
      const urlParams = new URLSearchParams(window.location.search);
      const tempPassword = urlParams.get('tempPassword');
      if (tempPassword === 'true') {
        setError('보안을 위해 반드시 새로운 비밀번호로 변경해주세요.');
      }

      // 로컬스토리지에서 저장된 사원번호 불러오기
      const savedUsername = localStorage.getItem('savedUsername');
      const rememberSetting = localStorage.getItem('rememberUsername') === 'true';

      if (savedUsername && rememberSetting) {
        setUsername(savedUsername);
        setRememberUsername(true);
      }
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || '로그인에 실패했습니다.');
        setLoading(false);
        return;
      }

      // 사원번호 저장 설정 처리
      if (rememberUsername) {
        localStorage.setItem('savedUsername', username);
        localStorage.setItem('rememberUsername', 'true');
      } else {
        localStorage.removeItem('savedUsername');
        localStorage.removeItem('rememberUsername');
      }

      // 임시 비밀번호로 로그인한 경우 비밀번호 변경 모달 표시
      if (data.isTempPassword) {
        setIsTempPasswordUser(true);
        setShowPasswordChangeModal(true);
        setLoading(false);
        return;
      }

      // 일반 사용자는 기존 로직대로 진행
      try {
        const sessionResponse = await fetch('/api/auth/session');
        if (sessionResponse.ok) {
          const session = await sessionResponse.json();
          if (session.isAdmin || session.role === 'manager') {
            router.push('/admin');
          } else {
            router.push('/calendar');
          }
        } else {
          router.push('/calendar');
        }
      } catch {
        router.push('/calendar');
      }
      router.refresh();
    } catch (err) {
      setError('로그인 중 오류가 발생했습니다.');
      setLoading(false);
    }
  };

  // 비밀번호 변경 핸들러
  const handlePasswordChange = async () => {
    if (!newPassword || !confirmPassword) {
      setError('모든 필드를 입력해주세요.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('새 비밀번호가 일치하지 않습니다.');
      return;
    }

    if (newPassword.length < 6) {
      setError('비밀번호는 최소 6자리 이상이어야 합니다.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword }),
      });

      if (res.ok) {
        // 비밀번호 변경 성공 후 세션 정보 확인해서 리다이렉트
        try {
          const sessionResponse = await fetch('/api/auth/session');
          if (sessionResponse.ok) {
            const session = await sessionResponse.json();
            if (session.isAdmin || session.role === 'manager') {
              router.push('/admin');
            } else {
              router.push('/calendar');
            }
          } else {
            router.push('/calendar');
          }
        } catch {
          router.push('/calendar');
        }
        router.refresh();
      } else {
        const data = await res.json();
        setError(data.error || '비밀번호 변경에 실패했습니다.');
      }
    } catch (error) {
      setError('비밀번호 변경 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 relative overflow-hidden">
      {/* 애니메이션 배경 - 빨간색과 파란색이 왔다갔다 (진한 버전) */}
      <div className="absolute inset-0 bg-gradient-to-br from-red-200 via-gray-50 to-blue-200">
        <div className="absolute inset-0 bg-gradient-to-r from-red-300/50 via-transparent to-blue-300/50" style={{ backgroundSize: '200% 200%', animation: 'shift 8s ease-in-out infinite' }}></div>
        <div className="absolute inset-0 bg-gradient-to-br from-red-200/40 via-blue-200/40 to-red-200/40" style={{ backgroundSize: '200% 200%', animation: 'wave 12s ease-in-out infinite' }}></div>
        <div className="absolute inset-0">
          <div className="absolute top-10 left-10 w-32 h-32 bg-red-400/30 rounded-full blur-xl" style={{ animation: 'float 8s ease-in-out infinite' }}></div>
          <div className="absolute top-40 right-20 w-24 h-24 bg-blue-400/30 rounded-full blur-xl" style={{ animation: 'float 12s ease-in-out infinite reverse' }}></div>
          <div className="absolute bottom-20 left-1/4 w-20 h-20 bg-red-500/25 rounded-full blur-xl" style={{ animation: 'float 10s ease-in-out infinite' }}></div>
          <div className="absolute bottom-40 right-1/3 w-16 h-16 bg-blue-500/25 rounded-full blur-xl" style={{ animation: 'float 14s ease-in-out infinite reverse' }}></div>
        </div>
      </div>

      {/* 콘텐츠 */}
      <div className="w-full max-w-md relative z-10">
        {/* 로그인 폼 카드 */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-8">
          <div className="text-center mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-1">
              디지털 화상고객센터 근태 관리
            </h2>
            <p className="text-gray-500 text-sm">
              계정 정보를 입력해주세요
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="username" className="block text-sm font-medium text-gray-700">
                사원번호
              </label>
              <div className="relative">
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all duration-200 text-gray-900 placeholder-gray-400 bg-gray-50/50 focus:bg-white"
                  placeholder="사원번호를 입력하세요"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                비밀번호
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3 pr-12 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all duration-200 text-gray-900 placeholder-gray-400 bg-gray-50/50 focus:bg-white"
                  placeholder="비밀번호를 입력하세요"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors duration-200"
                >
                  {showPassword ? (
                    <FiEyeOff className="w-5 h-5" />
                  ) : (
                    <FiEye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            {/* 사원번호 저장 옵션 */}
            <div className="flex items-center">
              <input
                id="rememberUsername"
                type="checkbox"
                checked={rememberUsername}
                onChange={(e) => setRememberUsername(e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="rememberUsername" className="ml-2 block text-sm text-gray-700">
                사원번호 저장
              </label>
            </div>

            {error && (
              <div className="bg-red-50/80 backdrop-blur-sm border border-red-200/50 text-red-700 px-4 py-3 rounded-xl text-sm font-medium">
                <div className="flex items-center">
                  <svg className="w-4 h-4 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  {error}
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 rounded-xl font-medium hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              <span className="flex items-center justify-center">
                {loading && (
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                {loading ? '로그인 중...' : '로그인'}
              </span>
            </button>
          </form>
        </div>

        {/* 푸터 텍스트 */}
        <div className="text-center mt-8">
          <p className="text-xs text-gray-500">
            © 2025 Hanwha General Insurance Co., Ltd.
          </p>
          <p className="text-xs text-gray-500">All rights reserved.</p>
        </div>
      </div>

      {/* 비밀번호 변경 모달 */}
      {showPasswordChangeModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-xl">
            <h3 className="text-lg font-bold text-gray-900 mb-4">비밀번호 변경</h3>
            <div className="mb-6">
              <p className="text-sm text-gray-700 mb-4">
                보안을 위해 임시 비밀번호로 로그인하셨습니다. 계속 진행하시려면 반드시 새로운 비밀번호를 설정해주세요.
              </p>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                <div className="text-sm text-yellow-800">
                  <div className="font-medium mb-1">비밀번호 요구사항:</div>
                  <ul className="list-disc list-inside text-xs space-y-1">
                    <li>최소 6자리 이상</li>
                    <li>보안을 위해 강력한 비밀번호를 사용하세요</li>
                  </ul>
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  새 비밀번호
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="새 비밀번호를 입력하세요"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  새 비밀번호 확인
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="새 비밀번호를 다시 입력하세요"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-900"
                />
              </div>
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
                  {error}
                </div>
              )}
              <div className="pt-2">
                <button
                  onClick={handlePasswordChange}
                  disabled={loading}
                  className="w-full px-4 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50"
                >
                  {loading ? '변경 중...' : '비밀번호 변경'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

