'use client';

import { useState, useRef, useEffect } from 'react';
import { FiMenu, FiX } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';

interface MenuItem {
    label: string;
    onClick: () => void;
    className?: string;
}

interface HamburgerMenuProps {
    items: MenuItem[];
}

export default function HamburgerMenu({ items }: HamburgerMenuProps) {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    return (
        <div className="relative" ref={menuRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-700"
                aria-label="메뉴 열기"
            >
                {isOpen ? <FiX size={24} /> : <FiMenu size={24} />}
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden z-50"
                    >
                        <div className="py-1">
                            {items.map((item, index) => (
                                <button
                                    key={index}
                                    onClick={() => {
                                        item.onClick();
                                        setIsOpen(false);
                                    }}
                                    className={`w-full text-left px-4 py-3 text-sm font-medium hover:bg-gray-50 transition-colors ${item.className || 'text-gray-700'}`}
                                >
                                    {item.label}
                                </button>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
