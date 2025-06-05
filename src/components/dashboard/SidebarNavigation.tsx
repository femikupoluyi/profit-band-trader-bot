
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
    <Sidebar className="border-r bg-blue-50 shadow-sm">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-blue-800 font-bold text-lg px-4 py-4 bg-gradient-to-r from-blue-100 to-blue-200 border-b border-blue-200">
            Trading Dashboard
          </SidebarGroupLabel>
          <SidebarGroupContent className="mt-2 px-2">
            <SidebarMenu>
              {navigationItems.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton 
                    asChild
                    isActive={activeTab === item.id}
                    className="group mb-1"
                  >
                    <Button
                      variant="ghost"
                      className={`w-full justify-start transition-all duration-200 ${
                        activeTab === item.id 
                          ? "bg-blue-500 text-white shadow-sm hover:bg-blue-600" 
                          : "text-blue-700 hover:bg-blue-100 hover:text-blue-800"
                      }`}
                      onClick={() => onTabChange(item.id)}
                    >
                      <item.icon className={`h-4 w-4 mr-3 transition-colors ${
                        activeTab === item.id ? "text-white" : "text-blue-600"
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
