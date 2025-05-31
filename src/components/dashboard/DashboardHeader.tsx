
import React from 'react';
import { Button } from '@/components/ui/button';
import { TrendingUp, LogOut } from 'lucide-react';
import MobileMenu from './MobileMenu';

interface DashboardHeaderProps {
  userEmail?: string;
  onSignOut: () => void;
}

const DashboardHeader = ({ userEmail, onSignOut }: DashboardHeaderProps) => {
  return (
    <header className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <TrendingUp className="h-8 w-8 text-blue-600 mr-3" />
            <h1 className="text-xl font-semibold text-gray-900 hidden sm:block">Crypto Trading Bot</h1>
            <h1 className="text-lg font-semibold text-gray-900 sm:hidden">Trading Bot</h1>
          </div>
          <div className="flex items-center space-x-2 sm:space-x-4">
            <span className="text-sm text-gray-700 hidden sm:inline">Welcome, {userEmail}</span>
            <MobileMenu />
            <Button variant="outline" size="sm" onClick={onSignOut}>
              <LogOut className="h-4 w-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Sign Out</span>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default DashboardHeader;
