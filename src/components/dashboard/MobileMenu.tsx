
import React from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Menu, Settings, Key, Activity, BarChart3 } from 'lucide-react';

const MobileMenu = () => {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="md:hidden">
          <Menu className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[300px] sm:w-[400px]">
        <div className="flex flex-col space-y-4 mt-4">
          <h2 className="text-lg font-semibold">Navigation</h2>
          <div className="flex flex-col space-y-2">
            <Button variant="ghost" className="justify-start">
              <Settings className="h-4 w-4 mr-2" />
              Configuration
            </Button>
            <Button variant="ghost" className="justify-start">
              <Key className="h-4 w-4 mr-2" />
              API Setup
            </Button>
            <Button variant="ghost" className="justify-start">
              <Activity className="h-4 w-4 mr-2" />
              Trading Status
            </Button>
            <Button variant="ghost" className="justify-start">
              <BarChart3 className="h-4 w-4 mr-2" />
              Trade History
            </Button>
            <Button variant="ghost" className="justify-start">
              <Activity className="h-4 w-4 mr-2" />
              System Logs
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default MobileMenu;
