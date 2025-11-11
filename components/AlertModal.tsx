'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { FiX, FiAlertCircle, FiCheckCircle, FiXCircle } from 'react-icons/fi';

interface AlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  type?: 'info' | 'success' | 'error' | 'warning';
  confirmText?: string;
  onConfirm?: () => void;
}

export default function AlertModal({
  isOpen,
  onClose,
  title,
  message,
  type = 'info',
  confirmText = '확인',
  onConfirm
}: AlertModalProps) {
  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm();
    }
    onClose();
  };

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <FiCheckCircle className="w-6 h-6 text-green-600" />;
      case 'error':
        return <FiXCircle className="w-6 h-6 text-red-600" />;
      case 'warning':
        return <FiAlertCircle className="w-6 h-6 text-yellow-600" />;
      default:
        return <FiAlertCircle className="w-6 h-6 text-blue-600" />;
    }
  };

  const getButtonColor = () => {
    switch (type) {
      case 'success':
        return 'bg-green-600 hover:bg-green-700 focus:ring-green-500';
      case 'error':
        return 'bg-red-600 hover:bg-red-700 focus:ring-red-500';
      case 'warning':
        return 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500';
      default:
        return 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500';
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed left-0 right-0 top-1/2 -translate-y-1/2 max-w-md mx-auto bg-white rounded-xl shadow-xl z-50 p-6"
          >
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                {getIcon()}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {title}
                </h3>
                <p className="text-sm text-gray-600 whitespace-pre-line">
                  {message}
                </p>
              </div>
              <button
                onClick={onClose}
                className="flex-shrink-0 p-1 hover:bg-gray-100 rounded-lg transition"
              >
                <FiX className="w-4 h-4 text-gray-400" />
              </button>
            </div>

            <div className="flex justify-end mt-6">
              <button
                onClick={handleConfirm}
                className={`px-4 py-2 text-sm font-medium text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 transition ${getButtonColor()}`}
              >
                {confirmText}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
