import React from 'react';

const Toast = ({ message, type, onClose }) => {
  const bgColor = {
    success: 'bg-green-500',
    error: 'bg-red-500',
    info: 'bg-blue-500',
    warning: 'bg-yellow-500'
  };

  return (
    <div className={`fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 ${bgColor[type] || bgColor.info} text-white max-w-sm`}>
      <div className="flex items-center justify-between">
        <span className="text-sm">{message}</span>
        <button 
          onClick={onClose}
          className="ml-4 text-white hover:text-gray-200 focus:outline-none"
        >
          ×
        </button>
      </div>
    </div>
  );
};

export default Toast;
