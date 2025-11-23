'use client';

import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';

interface AIChatModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function AIChatModal({ isOpen, onClose }: AIChatModalProps) {
    const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'assistant', content: string }>>([]);
    const [chatInput, setChatInput] = useState('');
    const [isChatLoading, setIsChatLoading] = useState(false);
    const chatAreaRef = useRef<HTMLDivElement>(null);

    // AI 채팅 관련 핸들러
    const handleSendMessage = async () => {
        if (!chatInput.trim() || isChatLoading) return;

        const userMessage = chatInput.trim();
        setChatInput('');
        setChatMessages(prev => [...prev, { role: 'user', content: userMessage }, { role: 'assistant', content: '' }]);
        setIsChatLoading(true);

        try {
            const response = await fetch('/api/ai/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: userMessage }),
            });

            if (!response.ok) {
                throw new Error('AI 채팅 요청 실패');
            }

            const reader = response.body?.getReader();
            const decoder = new TextDecoder();
            let accumulatedResponse = '';

            if (reader) {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const chunk = decoder.decode(value, { stream: true });
                    const lines = chunk.split('\n').filter(line => line.trim());

                    for (const line of lines) {
                        try {
                            const data = JSON.parse(line);

                            if (data.type === 'token' || data.type === 'chunk') {
                                accumulatedResponse += data.content;
                                setChatMessages(prev => {
                                    const newMessages = [...prev];
                                    const lastMessage = newMessages[newMessages.length - 1];
                                    if (lastMessage.role === 'assistant') {
                                        lastMessage.content = accumulatedResponse;
                                    }
                                    return newMessages;
                                });
                            } else if (data.type === 'complete' || data.done) {
                                // 스트리밍 완료
                                break;
                            } else if (data.type === 'error') {
                                throw new Error(data.error || '스트리밍 중 오류 발생');
                            }
                        } catch (parseError) {
                            console.error('JSON 파싱 오류:', parseError, 'Line:', line);
                        }
                    }
                }
            } else {
                // 스트리밍을 지원하지 않는 경우 폴백
                const data = await response.json();
                setChatMessages(prev => {
                    const newMessages = [...prev];
                    const lastMessage = newMessages[newMessages.length - 1];
                    if (lastMessage.role === 'assistant') {
                        lastMessage.content = data.response;
                    }
                    return newMessages;
                });
            }

        } catch (error) {
            console.error('AI 채팅 오류:', error);
            setChatMessages(prev => {
                const newMessages = [...prev];
                const lastMessage = newMessages[newMessages.length - 1];
                if (lastMessage.role === 'assistant') {
                    lastMessage.content = '죄송합니다. AI 응답을 가져오는 중 오류가 발생했습니다.';
                }
                return newMessages;
            });
        } finally {
            setIsChatLoading(false);
        }
    };

    const handleChatKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    // AI 채팅 메시지 변경 시 자동 스크롤
    useEffect(() => {
        if (chatAreaRef.current) {
            chatAreaRef.current.scrollTop = chatAreaRef.current.scrollHeight;
        }
    }, [chatMessages]);

    // ESC 키로 모달 닫기
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleKeyDown);
        }

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full h-[80vh] flex flex-col">
                {/* 헤더 */}
                <div className="flex items-center justify-between p-4 bg-blue-500 border-b border-blue-600 rounded-t-xl">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
                            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-semibold text-white">AI 챗</h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-blue-600 rounded-lg transition-colors"
                    >
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* 채팅 영역 */}
                <div ref={chatAreaRef} className="flex-1 overflow-y-auto p-4 bg-blue-50/40 flex flex-col">
                    {chatMessages.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center">
                            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                </svg>
                            </div>
                            <p className="text-gray-500 text-sm text-center">AI와 대화를 시작해보세요!</p>
                        </div>
                    ) : (
                        chatMessages.map((message, index) => (
                            <div
                                key={index}
                                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} mb-4`}
                            >
                                <div
                                    className={`max-w-[70%] rounded-lg px-3 py-2 ${message.role === 'user'
                                            ? 'bg-blue-500 text-white'
                                            : 'bg-gray-100 text-gray-900'
                                        }`}
                                >
                                    {message.role === 'user' ? (
                                        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                                    ) : (
                                        <div className="text-sm prose prose-sm max-w-none prose-headings:text-gray-900 prose-p:text-gray-900 prose-strong:text-gray-900 prose-code:text-gray-800 prose-pre:bg-gray-200 prose-pre:text-gray-800">
                                            <ReactMarkdown>{message.content}</ReactMarkdown>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                    {isChatLoading && (
                        <div className="flex justify-start">
                            <div className="bg-gray-100 rounded-lg px-3 py-2">
                                <div className="flex items-center gap-1">
                                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* 입력 영역 */}
                <div className="border-t border-gray-200 p-4">
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            onKeyPress={handleChatKeyPress}
                            placeholder="메시지를 입력하세요..."
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-900"
                            disabled={isChatLoading}
                        />
                        <button
                            onClick={handleSendMessage}
                            disabled={!chatInput.trim() || isChatLoading}
                            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
