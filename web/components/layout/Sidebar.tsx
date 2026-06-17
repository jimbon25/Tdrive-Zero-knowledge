"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Files, 
  Clock, 
  Settings, 
  Database,
  ShieldCheck,
  Terminal,
  Trash2,
  BarChart3,
  Star,
  Sparkles,
  Server
} from "lucide-react";
import { useUIStore } from "@/store/useUIStore";
import { cn } from "@/components/ui";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import { SystemStatus, StructuredResponse } from "@/types";

interface SidebarProps {
  isMobile?: boolean;
}

export function Sidebar({ isMobile = false }: SidebarProps) {
  const { isDesktopSidebarOpen, setMobileMenuOpen } = useUIStore();
  const pathname = usePathname();

  const { data: status } = useQuery({
    queryKey: ["system-status"],
    queryFn: async () => {
      const resp = await api.get<StructuredResponse<SystemStatus>>("/system/status");
      return resp.data.data;
    },
    refetchInterval: 30000,
  });

  const navItems = [
    { name: "My Files", href: "/files", icon: Files },
    { name: "Analytics", href: "/analytics", icon: BarChart3 },
    { name: "Recent Tasks", href: "/jobs", icon: Clock },
    { name: "Starred", href: "/starred", icon: Star },
    { name: "Trash Bin", href: "/trash", icon: Trash2 },
    { name: "Cleanup", href: "/cleanup", icon: Sparkles },
    { name: "Server", href: "/server", icon: Server },
    { name: "Settings", href: "/settings", icon: Settings },
    { name: "Developer", href: "/developer", icon: Terminal },
  ];

  const handleLinkClick = () => {
    if (isMobile) setMobileMenuOpen(false);
  };

  const formatSize = (bytes: number) => {
    if (!bytes) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  return (
    <div className={cn(
      "flex flex-col h-full bg-card select-none",
      !isMobile && "border-r border-neutral-100 dark:border-neutral-800",
      isMobile ? "w-full" : (isDesktopSidebarOpen ? "w-[220px]" : "w-0")
    )}>
      {/* 1. Navigation Container */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto scrollbar-none">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={handleLinkClick}
              className={cn(
                "flex items-center px-3 py-2 rounded-lg transition-all group min-h-[40px]",
                isActive 
                  ? "bg-primary/10 text-primary font-bold shadow-sm shadow-primary/5" 
                  : "hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100"
              )}
            >
              <item.icon size={18} className={cn("shrink-0", isActive && "text-primary")} />
              <span className="ml-3 text-[13px] font-semibold tracking-tight">{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* 2. Compact Storage Indicator */}
      <div className="p-4 space-y-4 border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50/40 dark:bg-neutral-900/10">
        <div className="space-y-3">
          <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-[0.15em] text-neutral-400">
             <div className="flex items-center space-x-2">
                <Database size={10} />
                <span>Storage</span>
             </div>
             <span className="text-primary italic">Unlimited</span>
          </div>
          
          <div className="h-1 w-full bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary rounded-full transition-all duration-1000 ease-out" 
              style={{ width: status?.active_storage ? '18%' : '3%' }} 
            />
          </div>
          
          <div className="flex flex-col space-y-0.5">
             <p className="text-[10px] font-bold text-neutral-700 dark:text-neutral-300">
                {formatSize(status?.active_storage || 0)} <span className="text-neutral-400 font-medium">Cloud</span>
             </p>
          </div>
        </div>

        {/* Security Badge */}
        <div className="flex items-center space-x-2 p-2 bg-primary/5 rounded-xl border border-primary/10 group cursor-help transition-colors hover:bg-primary/10">
          <ShieldCheck size={14} className="text-primary shrink-0" />
          <span className="text-[9px] font-black text-primary uppercase tracking-widest leading-none">Security Active</span>
        </div>
      </div>
    </div>
  );
}
