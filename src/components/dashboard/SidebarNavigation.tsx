
import React from 'react';
import { Button } from '@/components/ui/button';
import { 
  Sidebar, 
  SidebarContent, 
  SidebarGroup, 
  SidebarGroupContent, 
  SidebarGroupLabel, 
  SidebarMenu, 
  SidebarMenuButton, 
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger
} from '@/components/ui/sidebar';
import { Settings, Key, Activity, BarChart3, FileText, ScrollText } from 'lucide-react';

interface SidebarNavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const navigationItems = [
  {
    id: 'status',
    title: 'Trading Status',
    icon: Activity,
  },
  {
    id: 'trades',
    title: 'Trade History',
    icon: BarChart3,
  },
  {
    id: 'reports',
    title: 'Reports',
    icon: FileText,
  },
  {
    id: 'config',
    title: 'Configuration',
    icon: Settings,
  },
  {
    id: 'logs',
    title: 'System Logs',
    icon: ScrollText,
  },
  {
    id: 'api',
    title: 'API Setup',
    icon: Key,
  },
];

export function AppSidebar({ activeTab, onTabChange }: SidebarNavigationProps) {
  return (
    <Sidebar className="border-r bg-blue-400 shadow-lg">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-white font-bold text-lg px-4 py-3 bg-blue-500 bg-opacity-50">
            Trading Dashboard
          </SidebarGroupLabel>
          <SidebarGroupContent className="mt-2">
            <SidebarMenu>
              {navigationItems.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton 
                    asChild
                    isActive={activeTab === item.id}
                    className="group"
                  >
                    <Button
                      variant="ghost"
                      className={`w-full justify-start transition-all duration-200 mx-2 my-1 ${
                        activeTab === item.id 
                          ? "bg-white text-blue-600 shadow-md hover:bg-gray-50" 
                          : "text-white hover:bg-blue-300 hover:bg-opacity-50"
                      }`}
                      onClick={() => onTabChange(item.id)}
                    >
                      <item.icon className={`h-4 w-4 mr-3 transition-colors ${
                        activeTab === item.id ? "text-blue-600" : "text-white"
                      }`} />
                      <span className="font-medium">{item.title}</span>
                    </Button>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

export { SidebarProvider, SidebarTrigger };
