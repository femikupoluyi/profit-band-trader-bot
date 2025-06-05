
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
    <Sidebar className="border-r bg-gradient-to-b from-slate-50 to-slate-100 shadow-sm">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-slate-700 font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            Trading Dashboard
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton 
                    asChild
                    isActive={activeTab === item.id}
                    className="group"
                  >
                    <Button
                      variant={activeTab === item.id ? "default" : "ghost"}
                      className={`w-full justify-start transition-all duration-200 ${
                        activeTab === item.id 
                          ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md hover:from-blue-700 hover:to-indigo-700" 
                          : "text-slate-700 hover:bg-blue-50 hover:text-blue-700 border-l-4 border-transparent hover:border-blue-500"
                      }`}
                      onClick={() => onTabChange(item.id)}
                    >
                      <item.icon className={`h-4 w-4 mr-3 transition-colors ${
                        activeTab === item.id ? "text-white" : "text-slate-600 group-hover:text-blue-600"
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
