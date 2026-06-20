"use client";

import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import { ServiceStatus, ServiceLogResponse, StructuredResponse } from "@/types";
import { Button, cn } from "@/components/ui";
import { useUIStore } from "@/store/useUIStore";
import { 
  Server, 
  Play, 
  Square, 
  RotateCcw, 
  Terminal, 
  Search, 
  X, 
  Loader2, 
  RefreshCw,
  Activity,
  AlertCircle,
  CheckCircle2,
  Lock,
  ShieldAlert,
  Key,
  Filter,
  FileQuestion,
  Pin,
  ChevronRight,
  LogOut,
  Settings,
  ShieldCheck
} from "lucide-react";
import toast from "react-hot-toast";

export default function ServerPage() {
  const queryClient = useQueryClient();
  const { isServerUnlocked, setServerUnlocked } = useUIStore();
  const [searchTerm, setSearchTerm] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<"all" | "active" | "inactive" | "failed" | "not-found">("all");
  const [selectedService, setSelectedService] = React.useState<string | null>(null);
  const [showLogs, setShowLogs] = React.useState(false);
  const [unlockPassword, setUnlockPassword] = React.useState("");
  const logEndRef = React.useRef<HTMLDivElement>(null);

  // Fetch Services
  const { data: services, isLoading, isRefetching } = useQuery({
    queryKey: ["server-services"],
    queryFn: async () => {
      const resp = await api.get<StructuredResponse<ServiceStatus[]>>("/system/services");
      return resp.data.data || [];
    },
    refetchInterval: 10000,
    enabled: isServerUnlocked,
  });

  // Fetch Logs
  const { data: logsData, isLoading: logsLoading } = useQuery({
    queryKey: ["service-logs", selectedService],
    queryFn: async () => {
      if (!selectedService) return null;
      const resp = await api.get<StructuredResponse<ServiceLogResponse>>(`/system/services/${selectedService}/logs?lines=100`);
      return resp.data.data;
    },
    enabled: !!selectedService && showLogs && isServerUnlocked,
    refetchInterval: 3000,
  });

  // Auto-scroll logs
  React.useEffect(() => {
    if (showLogs && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logsData, showLogs]);

  // Unlock Mutation
  const unlockMutation = useMutation({
    mutationFn: async (password: string) => {
      const resp = await api.post<StructuredResponse<boolean>>("/system/unlock", { password });
      return resp.data;
    },
    onSuccess: (data) => {
      if (data.success) {
        setServerUnlocked(true);
        setUnlockPassword("");
        toast.success("Identity Verified");
      } else {
        toast.error("Invalid Master Password");
      }
    },
    onError: () => {
      toast.error("Verification failed");
    }
  });

  // Service Action Mutation
  const actionMutation = useMutation({
    mutationFn: async ({ name, action }: { name: string, action: string }) => {
      const resp = await api.post(`/system/services/${name}/action`, { action });
      return resp.data;
    },
    onSuccess: (_, variables) => {
      toast.success(`Service ${variables.action}ed`);
      queryClient.invalidateQueries({ queryKey: ["server-services"] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || "Operation failed");
    }
  });

  // Pin Mutation
  const pinMutation = useMutation({
    mutationFn: async ({ name, pinned }: { name: string, pinned: boolean }) => {
      const resp = await api.post(`/system/services/${name}/pin?pinned=${pinned}`);
      return resp.data;
    },
    onSuccess: (_, variables) => {
      toast.success(variables.pinned ? "Pinned to top" : "Unpinned");
      queryClient.invalidateQueries({ queryKey: ["server-services"] });
    },
    onError: () => {
      toast.error("Failed to update priority");
    }
  });

  if (!isServerUnlocked) {
    return (
      <div className="h-[75vh] flex items-center justify-center p-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
         <div className="bg-card border border-neutral-200 dark:border-neutral-800 rounded-[2.5rem] p-8 md:p-12 w-full max-w-md shadow-2xl space-y-8 text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-primary/20" />
            
            <div className="space-y-4">
               <div className="w-20 h-20 bg-primary/10 text-primary rounded-3xl flex items-center justify-center mx-auto relative shadow-inner">
                  <Lock size={36} />
                  <div className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full border-4 border-card flex items-center justify-center">
                     <ShieldAlert size={12} className="text-white" />
                  </div>
               </div>
               <div>
                  <h2 className="text-2xl font-black tracking-tight">System Guard</h2>
                  <p className="text-[10px] text-neutral-400 font-black uppercase tracking-[0.2em] mt-1">Master Password Required</p>
               </div>
            </div>

            <div className="space-y-4">
               <div className="relative group">
                  <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 group-focus-within:text-primary transition-colors" size={18} />
                  <input 
                    type="password"
                    placeholder="Enter Master Password..."
                    value={unlockPassword}
                    onChange={(e) => setUnlockPassword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && unlockMutation.mutate(unlockPassword)}
                    className="w-full bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl pl-12 pr-4 h-14 text-sm font-bold focus:ring-4 focus:ring-primary/10 outline-none transition-all"
                    autoFocus
                  />
               </div>
               <Button 
                className="w-full h-14 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-primary/20 transition-all active:scale-[0.98]"
                disabled={!unlockPassword || unlockMutation.isPending}
                onClick={() => unlockMutation.mutate(unlockPassword)}
               >
                  {unlockMutation.isPending ? <Loader2 className="animate-spin" size={20} /> : "Verify Identity"}
               </Button>
            </div>

            <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest leading-relaxed">
               Elevated privileges required for <br/> systemd service management
            </p>
         </div>
      </div>
    );
  }

  // Combined Search and Filter Logic
  const filteredServices = services?.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          s.description.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = 
      statusFilter === "all" ? true :
      statusFilter === "active" ? s.active_state === "active" :
      statusFilter === "inactive" ? (s.active_state !== "active" && s.load_state !== "not-found") :
      statusFilter === "failed" ? s.sub_state === "failed" :
      statusFilter === "not-found" ? s.load_state === "not-found" : true;

    return matchesSearch && matchesFilter;
  }).sort((a, b) => {
    if (a.is_pinned && !b.is_pinned) return -1;
    if (!a.is_pinned && b.is_pinned) return 1;
    return a.name.localeCompare(b.name);
  });

  const stats = {
    total: services?.length || 0,
    active: services?.filter(s => s.active_state === "active").length || 0,
    failed: services?.filter(s => s.sub_state === "failed").length || 0,
    notFound: services?.filter(s => s.load_state === "not-found").length || 0,
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-[#fafafa] dark:bg-neutral-950 scrollbar-none pb-20 md:pb-8">
      
      {/* 1. Slim Header (Matches Analytics) */}
      <header className="px-6 pt-8 pb-6 md:px-10 md:pt-10 md:pb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
           <div className="flex items-center space-x-2 mb-1">
              <div className="w-8 h-1 bg-primary rounded-full" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">System Core</span>
           </div>
           <h1 className="text-3xl md:text-4xl font-black tracking-tight text-neutral-900 dark:text-neutral-50 flex items-center space-x-3">
             <span>Server <span className="text-neutral-400 dark:text-neutral-600">Control</span></span>
             <div className="px-2 py-1 bg-green-500/10 text-green-500 border border-green-500/20 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center mb-1">
               <ShieldCheck size={10} className="mr-1" />
               Auth
             </div>
           </h1>
        </div>
        
        <div className="flex items-center space-x-2">
           <div className="relative flex-1 md:flex-none">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={16} />
              <input 
                type="text"
                placeholder="Search units..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-4 h-10 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none w-full md:w-56 transition-all shadow-sm"
              />
           </div>
           <Button 
              variant="outline" 
              size="icon" 
              className="h-10 w-10 rounded-xl bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 shadow-sm hover:text-red-500 hover:border-red-500/30"
              onClick={() => setServerUnlocked(false)}
              title="Lock Server"
           >
              <LogOut size={16} />
           </Button>
           <Button 
              variant="outline" 
              size="icon" 
              className="h-10 w-10 rounded-xl bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 shadow-sm text-primary"
              onClick={() => queryClient.invalidateQueries({ queryKey: ["server-services"] })}
           >
              <RefreshCw size={16} className={cn(isRefetching && "animate-spin")} />
           </Button>
        </div>
      </header>

      <div className="px-6 md:px-10 space-y-6 md:space-y-8">

        {/* 2. Compact Stats Overview */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
           <CompactStatItem icon={Activity} label="Total Units" value={stats.total} theme="blue" />
           <CompactStatItem icon={CheckCircle2} label="Active" value={stats.active} theme="emerald" />
           <CompactStatItem icon={AlertCircle} label="Failures" value={stats.failed} theme="rose" />
           <CompactStatItem icon={FileQuestion} label="Missing" value={stats.notFound} theme="gray" />
        </div>

      {/* 3. Control Bar (Compact) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-2">
         <div className="flex items-center space-x-1 p-1 bg-white dark:bg-neutral-900 rounded-xl w-full sm:w-auto border border-neutral-200 dark:border-neutral-800 overflow-x-auto no-scrollbar shadow-sm">
            {[
               { id: "all", label: "All" },
               { id: "active", label: "Live" },
               { id: "failed", label: "Failed" },
               { id: "not-found", label: "Missing" }
            ].map((f) => (
               <button
                  key={f.id}
                  onClick={() => setStatusFilter(f.id as any)}
                  className={cn(
                     "flex-1 sm:flex-none flex items-center justify-center px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
                     statusFilter === f.id 
                        ? "bg-neutral-100 dark:bg-neutral-800 text-primary shadow-sm border border-neutral-200/50 dark:border-neutral-700" 
                        : "text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 border border-transparent"
                  )}
               >
                  {f.label}
               </button>
            ))}
         </div>
      </div>

      {/* 4. Services List */}
      {isLoading ? (
        <div className="py-20 text-center space-y-4">
          <Loader2 className="animate-spin mx-auto text-primary" size={32} />
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-neutral-400">Syncing with systemd...</p>
        </div>
      ) : filteredServices?.length === 0 ? (
        <div className="py-20 text-center bg-white dark:bg-neutral-900 border border-dashed border-neutral-200 dark:border-neutral-800 rounded-[2rem]">
          <FileQuestion className="mx-auto text-neutral-300 mb-4" size={40} strokeWidth={1.5} />
          <p className="text-xs font-bold uppercase tracking-widest text-neutral-400">No matching services found</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 rounded-3xl shadow-sm flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-500 mb-6">
          <div className="flex-1 overflow-hidden py-2">
            {filteredServices?.map((service) => (
              <ServiceCard 
                key={service.name}
                service={service}
                onPin={() => pinMutation.mutate({ name: service.name, pinned: !service.is_pinned })}
                onAction={(action) => actionMutation.mutate({ name: service.name, action })}
                actionPending={actionMutation.isPending && actionMutation.variables?.name === service.name}
                onLogs={() => {
                  setSelectedService(service.name);
                  setShowLogs(true);
                }}
              />
            ))}
          </div>
        </div>
      )}
      </div>

      {/* Log Viewer Modal */}
      {showLogs && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-0 md:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
           <div className="bg-neutral-950 border border-neutral-800 w-full max-w-4xl h-full md:h-[85vh] md:rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden">
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-5 border-b border-neutral-800 bg-neutral-900/50">
                 <div className="flex items-center space-x-4">
                    <div className="p-2 bg-primary/20 text-primary rounded-xl">
                      <Terminal size={20} />
                    </div>
                    <div>
                       <h3 className="text-sm md:text-base font-black text-white tracking-tight">{selectedService}</h3>
                       <p className="text-[9px] text-neutral-500 font-bold uppercase tracking-[0.2em] mt-0.5">Live Journal Stream</p>
                    </div>
                 </div>
                 <button 
                  onClick={() => setShowLogs(false)}
                  className="p-3 bg-neutral-800 hover:bg-neutral-700 rounded-2xl text-white transition-all active:scale-90"
                 >
                    <X size={20} />
                 </button>
              </div>

              {/* Modal Body (Logs) */}
              <div className="flex-1 p-4 md:p-8 overflow-y-auto font-mono text-[10px] md:text-[11px] leading-relaxed scrollbar-thin scrollbar-thumb-neutral-800 scrollbar-track-transparent bg-black">
                 {logsLoading && !logsData ? (
                   <div className="h-full flex flex-col items-center justify-center space-y-4 text-neutral-500">
                      <Loader2 className="animate-spin text-primary" size={32} />
                      <span className="text-[10px] font-black uppercase tracking-[0.3em]">Connecting to buffer...</span>
                   </div>
                 ) : (
                   <div className="space-y-1.5">
                      {logsData?.logs.map((log, i) => (
                        <div key={i} className="text-neutral-400 hover:bg-white/5 transition-colors px-2 py-0.5 rounded flex items-start group">
                           <span className="text-neutral-700 mr-4 select-none shrink-0 w-6 text-right group-hover:text-primary transition-colors">{i + 1}</span>
                           <span className="break-all">{log}</span>
                        </div>
                      ))}
                      <div ref={logEndRef} />
                      {logsData?.logs.length === 0 && <p className="text-neutral-500 italic text-center py-20 font-sans">No recent activity detected.</p>}
                   </div>
                 )}
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-5 border-t border-neutral-800 bg-neutral-900/50 flex justify-between items-center">
                 <div className="flex items-center space-x-3">
                    <div className="flex items-center space-x-2">
                       <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                       <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Live Updates Active</p>
                    </div>
                 </div>
                 <Button 
                   size="sm" 
                   variant="outline" 
                   className="h-10 rounded-xl border-neutral-700 text-neutral-300 hover:bg-neutral-800 font-bold" 
                   onClick={() => queryClient.invalidateQueries({ queryKey: ["service-logs", selectedService] })}
                 >
                    <RefreshCw size={14} className="mr-2" />
                    Refresh
                 </Button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}

// --- SUB-COMPONENTS ---

interface ServiceCardProps {
  service: ServiceStatus;
  onPin: () => void;
  onAction: (action: string) => void;
  actionPending: boolean;
  onLogs: () => void;
}

function ServiceCard({
  service,
  onPin,
  onAction,
  actionPending,
  onLogs
}: ServiceCardProps) {
  return (
    <div className="group relative transition-all duration-200 flex items-center justify-between p-3.5 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 rounded-2xl mx-2">
      <div className="flex items-center flex-1 min-w-0 space-x-4">
        {/* Icon */}
        <div className="shrink-0">
          <div className={cn(
            "w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0 border",
            service.active_state === "active" 
              ? "bg-emerald-50 dark:bg-emerald-900/10 text-emerald-500 border-emerald-100 dark:border-emerald-900/30" 
              : "bg-neutral-50 dark:bg-neutral-800 text-neutral-400 border-neutral-100 dark:border-neutral-700"
          )}>
            <Terminal size={18} strokeWidth={2.5} />
          </div>
        </div>

        {/* Name & Desc */}
        <div className="min-w-0 flex-1">
           <div className="flex items-center space-x-2">
              <h3 className="font-black tracking-tight truncate text-neutral-800 dark:text-neutral-200 group-hover:text-primary transition-colors text-[13px]">
                {service.name}
              </h3>
              {service.is_pinned && <Pin size={10} className="text-primary fill-current" />}
           </div>
           <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-tight truncate mt-0.5">
             {service.description || "No description provided"}
           </p>
        </div>

        {/* Status Badge */}
        <div className="mx-4 shrink-0 hidden md:flex w-24 justify-end">
           <StatusBadge state={service.active_state} subState={service.sub_state} loadState={service.load_state} />
        </div>
      </div>

      {/* Actions */}
      <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center space-x-1">
         <div className="flex items-center space-x-1">
           <ActionButton 
             icon={Pin} 
             onClick={onPin}
             className={cn(service.is_pinned ? "text-primary fill-current" : "text-neutral-400 hover:text-primary")}
             theme={service.is_pinned ? "primary" : "neutral"}
           />
           <ActionButton 
              icon={Terminal} 
              onClick={onLogs}
              theme="primary"
           />
           {service.load_state !== "not-found" && (
             <>
                <ActionButton 
                  icon={RotateCcw} 
                  onClick={() => onAction("restart")}
                  loading={actionPending}
                  theme="neutral"
                />
                <ActionButton 
                  icon={service.active_state === "active" ? Square : Play} 
                  onClick={() => onAction(service.active_state === "active" ? "stop" : "start")}
                  loading={actionPending}
                  theme={service.active_state === "active" ? "rose" : "emerald"}
                />
             </>
           )}
         </div>
      </div>
    </div>
  );
}


function CompactStatItem({ label, value, icon: Icon, theme }: any) {
   const colors: any = {
      blue: "text-blue-500 bg-blue-50 dark:bg-blue-900/10",
      emerald: "text-emerald-500 bg-emerald-50 dark:bg-emerald-900/10",
      rose: "text-rose-500 bg-rose-50 dark:bg-rose-900/10",
      amber: "text-amber-500 bg-amber-50 dark:bg-amber-900/10",
      gray: "text-neutral-500 bg-neutral-50 dark:bg-neutral-900/10"
   };

   return (
      <div className="bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 rounded-2xl p-4 flex items-center space-x-4 shadow-sm hover:shadow-md transition-all">
         <div className={cn("p-2 rounded-xl shrink-0", colors[theme])}>
            <Icon size={18} />
         </div>
         <div className="min-w-0">
            <p className="text-[9px] font-black text-neutral-400 uppercase tracking-[0.1em] truncate mb-0.5">{label}</p>
            <h3 className="text-base md:text-lg font-black text-neutral-900 dark:text-neutral-100 tracking-tight truncate leading-none">
               {value}
            </h3>
         </div>
      </div>
   );
}

function StatusBadge({ state, subState, loadState }: { state: string, subState: string, loadState: string }) {
  const isNotFound = loadState === "not-found";
  const isActive = state === "active";
  const isFailed = subState === "failed";

  if (isNotFound) {
    return (
      <div className="flex items-center space-x-1.5 px-2 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-500 text-[9px] font-black uppercase tracking-widest border border-neutral-200 dark:border-neutral-700">
        <div className="w-1.5 h-1.5 rounded-full bg-neutral-400" />
        <span>Missing</span>
      </div>
    );
  }

  return (
    <div className={cn(
      "flex items-center space-x-1.5 px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border",
      isActive 
        ? "bg-emerald-50 dark:bg-emerald-900/10 text-emerald-600 dark:text-emerald-400 border-emerald-200/50 dark:border-emerald-800" 
        : isFailed 
          ? "bg-rose-50 dark:bg-rose-900/10 text-rose-600 dark:text-rose-400 border-rose-200/50 dark:border-rose-800"
          : "bg-neutral-50 dark:bg-neutral-900/10 text-neutral-600 dark:text-neutral-400 border-neutral-200/50 dark:border-neutral-800"
    )}>
      <div className={cn(
        "w-1.5 h-1.5 rounded-full animate-pulse",
        isActive ? "bg-emerald-500" : isFailed ? "bg-rose-500" : "bg-neutral-500"
      )} />
      <span>{isActive ? "Active" : isFailed ? "Failed" : state}</span>
    </div>
  );
}

function ActionButton({ icon: Icon, onClick, loading, theme = "neutral", className }: any) {
   const themes: any = {
      primary: "hover:bg-primary/10 text-neutral-400 hover:text-primary",
      rose: "hover:bg-rose-500/10 text-neutral-400 hover:text-rose-500",
      emerald: "hover:bg-emerald-500/10 text-neutral-400 hover:text-emerald-500",
      neutral: "hover:bg-neutral-500/10 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
   };

   return (
      <button 
        className={cn("p-2 rounded-[10px] transition-colors", themes[theme], className)}
        onClick={onClick}
        disabled={loading}
      >
         {loading ? <Loader2 className="animate-spin" size={16} /> : <Icon size={16} />}
      </button>
   );
}
