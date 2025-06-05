
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
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Trading Dashboard</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton 
                    asChild
                    isActive={activeTab === item.id}
                  >
                    <Button
                      variant={activeTab === item.id ? "default" : "ghost"}
                      className="w-full justify-start"
                      onClick={() => onTabChange(item.id)}
                    >
                      <item.icon className="h-4 w-4 mr-2" />
                      <span>{item.title}</span>
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
