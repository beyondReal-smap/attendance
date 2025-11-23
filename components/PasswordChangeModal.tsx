'use client';

import { useState } from 'react';

interface PasswordChangeModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    onAlert: (title: string, message: string, type: 'info' | 'success' | 'error' | 'warning') => void;
}

export default function PasswordChangeModal({ isOpen, onClose, onSuccess, onAlert }: PasswordChangeModalProps) {
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    const handlePasswordChange = async () => {
        if (!newPassword || !confirmPassword) {
            onAlert('오류', '모든 필드를 입력해주세요.', 'error');
            return;
        }

        if (newPassword !== confirmPassword) {
            onAlert('오류', '새 비밀번호가 일치하지 않습니다.', 'error');
            return;
        }

        if (newPassword.length < 6) {
            onAlert('오류', '비밀번호는 최소 6자리 이상이어야 합니다.', 'error');
            return;
        }

        try {
            const res = await fetch('/api/auth/change-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ newPassword }),
            });

            if (res.ok) {
                onAlert('성공', '비밀번호가 성공적으로 변경되었습니다.', 'success');
                onSuccess();
                setNewPassword('');
                setConfirmPassword('');
                // 임시 비밀번호 플래그 제거
                localStorage.removeItem('tempPasswordLogin');
            } else {
                const data = await res.json();
                onAlert('오류', data.error || '비밀번호 변경에 실패했습니다.', 'error');
            }
        } catch (error) {
            onAlert('오류', '오류가 발생했습니다.', 'error');
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-xl">
                <h3 className="text-lg font-bold text-gray-900 mb-4">비밀번호 변경</h3>
                <div className="mb-6">
                    <p className="text-sm text-gray-700 mb-4">
                        보안을 위해 임시 비밀번호로 로그인하셨습니다. 새로운 비밀번호를 설정해주세요.
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
                    <div className="flex gap-3 pt-2">
                        <button
                            onClick={() => {
                                onClose();
                                setNewPassword('');
                                setConfirmPassword('');
                            }}
                            className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition"
                        >
                            나중에 변경
                        </button>
                        <button
                            onClick={handlePasswordChange}
                            className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition"
                        >
                            비밀번호 변경
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
