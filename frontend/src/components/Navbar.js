import React, { useState } from 'react';
import { Shield, Bell, LogOut, Search, Menu, X } from 'lucide-react';

const Navbar = ({ account, onDisconnect, isSidebarOpen, toggleSidebar }) => {
  const [showNotifications, setShowNotifications] = useState(false);
  
  return (
    <nav className="bg-white border-b border-gray-200 fixed top-0 left-0 right-0 z-30">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <div className="ml-4 flex items-center">
              <Shield className="h-8 w-8 text-blue-600" />
              <span className="ml-2 text-xl font-bold text-gray-900">dWill</span>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-3 px-3 py-2 bg-gray-100 rounded-lg">
              <div className="h-2 w-2 bg-green-400 rounded-full"></div>
              <span className="text-sm font-medium text-gray-700">
                {account}
              </span>
            </div>

            <button
              onClick={onDisconnect}
              className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
