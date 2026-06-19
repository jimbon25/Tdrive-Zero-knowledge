"use client";

import React from "react";
import { createPortal } from "react-dom";
import { useNotificationStore } from "@/store/useNotificationStore";
import { 
  Bell, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  Info, 
  AlertTriangle,
  Trash2,
  CheckCheck
} from "lucide-react";
import { Button, cn } from "@/components/ui";
import { formatDistanceToNow } from "date-fns";

export function NotificationCenter({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearAll } = useNotificationStore();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  React.useEffect(() => {
    if (isOpen) {
      import('@/lib/scrollLock').then(({ lockScroll }) => lockScroll());
      const handleEsc = (e: KeyboardEvent) => {
        if (e.key === "Escape") onClose();
      };
      window.addEventListener("keydown", handleEsc);
      return () => {
        import('@/lib/scrollLock').then(({ unlockScroll }) => unlockScroll());
        window.removeEventListener("keydown", handleEsc);
      };
    }
  }, [isOpen, onClose]);

  const getIcon = (type: string) => {
    switch (type) {
      case "success": return <CheckCircle2 className="text-emerald-500" size={20} />;
      case "error": return <AlertCircle className="text-destructive" size={20} />;
      case "warning": return <AlertTriangle className="text-amber-500" size={20} />;
      default: return <Info className="text-blue-500" size={20} />;
    }
  };

  if (!isOpen) return null;

  const drawerContent = (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 z-[140] bg-neutral-950/40 backdrop-blur-sm transition-opacity duration-300 animate-in fade-in" 
        onClick={onClose} 
      />
      
      {/* Drawer */}
      <div className={cn(
        "fixed inset-y-0 right-0 z-[150] flex flex-col h-full bg-background shadow-2xl transition-all duration-300 ease-in-out animate-in slide-in-from-right",
        "w-full md:w-[440px] border-l border-neutral-200 dark:border-neutral-800"
      )}>
        {/* Header */}
        <div className="flex flex-col border-b bg-background/95 backdrop-blur-md sticky top-0 z-10 border-neutral-200 dark:border-neutral-800">
          <div className="px-5 py-4 flex items-center justify-between">
            <div className="space-y-0.5">
              <h2 className="text-xl font-bold tracking-tight">Notifications</h2>
              <p className="text-xs font-medium text-neutral-500">
                {unreadCount > 0 ? `${unreadCount} unread messages` : "You're all caught up"}
              </p>
            </div>
            <button 
              onClick={onClose} 
              className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full transition-all active:scale-90"
              aria-label="Close notifications"
            >
              <X size={20} className="text-neutral-500" />
            </button>
          </div>

          {/* Quick Actions */}
          {notifications.length > 0 && (
            <div className="px-5 pb-3 flex items-center space-x-2">
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 px-2.5 text-[11px] font-bold text-primary hover:bg-primary/5"
                onClick={markAllAsRead}
              >
                <CheckCheck size={14} className="mr-1.5" />
                Mark all as read
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 px-2.5 text-[11px] font-bold text-neutral-500 hover:text-destructive hover:bg-destructive/5"
                onClick={clearAll}
              >
                <Trash2 size={14} className="mr-1.5" />
                Clear all
              </Button>
            </div>
          )}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto flex flex-col px-4 py-4 scrollbar-thin scrollbar-thumb-neutral-200 dark:scrollbar-thumb-neutral-800">
          {notifications.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-6 animate-in fade-in zoom-in-95 duration-500">
               <div className="w-16 h-16 bg-neutral-100 dark:bg-neutral-900 rounded-full flex items-center justify-center mb-4">
                  <Bell size={32} strokeWidth={1.5} className="text-neutral-400" />
               </div>
               <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100 mb-1">No notifications</h3>
               <p className="text-sm text-neutral-500 font-medium">You're all caught up. Check back later for updates.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {notifications.map((notif) => (
                <div 
                  key={notif.id}
                  onClick={() => !notif.read && markAsRead(notif.id)}
                  className={cn(
                    "group relative p-4 rounded-2xl border transition-all cursor-pointer",
                    notif.read 
                      ? "bg-card border-neutral-100 dark:border-neutral-800/50 hover:border-neutral-200 dark:hover:border-neutral-700" 
                      : "bg-primary/[0.02] border-primary/10 shadow-sm hover:bg-primary/[0.04] hover:border-primary/20 ring-1 ring-primary/5"
                  )}
                >
                  {/* Unread dot */}
                  {!notif.read && (
                    <div className="absolute top-4 right-4 w-2 h-2 bg-primary rounded-full" />
                  )}
                  
                  <div className="flex items-start space-x-4">
                    <div className={cn(
                      "p-2.5 rounded-xl shadow-sm shrink-0 transition-transform group-hover:scale-105",
                      notif.read ? "bg-neutral-50 dark:bg-neutral-900" : "bg-white dark:bg-neutral-950"
                    )}>
                       {getIcon(notif.type)}
                    </div>
                    <div className="flex-1 min-w-0 pr-4">
                      <h4 className={cn(
                        "text-sm font-bold leading-snug mb-1 transition-colors line-clamp-1",
                        notif.read ? "text-neutral-600 dark:text-neutral-400" : "text-neutral-900 dark:text-neutral-100"
                      )}>
                        {notif.title}
                      </h4>
                      <p className={cn(
                        "text-[13px] leading-relaxed font-medium transition-colors line-clamp-2",
                        notif.read ? "text-neutral-400 dark:text-neutral-500" : "text-neutral-600 dark:text-neutral-400"
                      )}>
                        {notif.message}
                      </p>
                      <div className="flex items-center mt-3 space-x-2">
                        <span className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-tight">
                          {formatDistanceToNow(notif.timestamp, { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );

  return mounted ? createPortal(drawerContent, document.body) : null;
}
