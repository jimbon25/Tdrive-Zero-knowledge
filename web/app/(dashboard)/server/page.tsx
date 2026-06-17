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
  ShieldCheck,
  LayoutGrid,
  List
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
  const [viewMode, setViewMode] = React.useState<"grid" | "list">("list");
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
    <div className="max-w-6xl mx-auto space-y-6 md:space-y-8 animate-in fade-in duration-500 pb-20 px-1 md:px-0">
      
      {/* 1. Header & Quick Actions */}
      <div className="flex flex-col space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-card border border-neutral-200 dark:border-neutral-800 p-6 rounded-[2rem] shadow-sm">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-primary text-white rounded-2xl shadow-xl shadow-primary/20">
              <Server size={24} />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-xl md:text-2xl font-black tracking-tight">System Core</h1>
                <div className="px-2 py-0.5 bg-green-500/10 text-green-500 border border-green-500/20 rounded-full text-[8px] font-black uppercase tracking-widest flex items-center">
                  <ShieldCheck size={10} className="mr-1" />
                  Authenticated
                </div>
              </div>
              <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-[0.2em] mt-1">Real-time Service Management</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
             <div className="relative flex-1 md:flex-none">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={16} />
                <input 
                  type="text"
                  placeholder="Search units..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 h-11 bg-neutral-100 dark:bg-neutral-900 border-none rounded-2xl text-sm font-medium focus:ring-2 focus:ring-primary/20 outline-none w-full md:w-64 transition-all"
                />
             </div>
             <Button 
                variant="outline" 
                size="icon" 
                className="h-11 w-11 rounded-2xl border-neutral-200 dark:border-neutral-800"
                onClick={() => setServerUnlocked(false)}
             >
                <LogOut size={18} />
             </Button>
             <Button 
                variant="outline" 
                size="icon" 
                className="h-11 w-11 rounded-2xl border-neutral-200 dark:border-neutral-800"
                onClick={() => queryClient.invalidateQueries({ queryKey: ["server-services"] })}
             >
                <RefreshCw size={18} className={cn(isRefetching && "animate-spin")} />
             </Button>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
           <StatCard icon={Activity} label="Total Units" value={stats.total} color="blue" />
           <StatCard icon={CheckCircle2} label="Active" value={stats.active} color="green" />
           <StatCard icon={AlertCircle} label="Failures" value={stats.failed} color="red" />
           <StatCard icon={FileQuestion} label="Unknown" value={stats.notFound} color="gray" />
        </div>
      </div>

      {/* 2. Control Bar */}
      <div className="sticky top-[64px] z-30 bg-background/80 backdrop-blur-md py-2 -mx-2 px-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
           <div className="flex items-center space-x-1 p-1 bg-neutral-100 dark:bg-neutral-800/50 rounded-2xl w-full sm:w-auto border border-neutral-200 dark:border-neutral-800 overflow-x-auto no-scrollbar">
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
                       "flex-1 sm:flex-none flex items-center justify-center space-x-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
                       statusFilter === f.id 
                          ? "bg-card text-primary shadow-md" 
                          : "text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
                    )}
                 >
                    {f.label}
                 </button>
              ))}
           </div>

           <div className="hidden sm:flex items-center space-x-1 bg-neutral-100 dark:bg-neutral-800/50 p-1 rounded-2xl border border-neutral-200 dark:border-neutral-800">
              <button 
                onClick={() => setViewMode("list")}
                className={cn("p-2 rounded-xl transition-all", viewMode === "list" ? "bg-card text-primary shadow-sm" : "text-neutral-500")}
              >
                <List size={16} />
              </button>
              <button 
                onClick={() => setViewMode("grid")}
                className={cn("p-2 rounded-xl transition-all", viewMode === "grid" ? "bg-card text-primary shadow-sm" : "text-neutral-500")}
              >
                <LayoutGrid size={16} />
              </button>
           </div>
        </div>
      </div>

      {/* 3. Services List/Grid */}
      <div className={cn(
        "animate-in fade-in slide-in-from-bottom-2 duration-500",
        viewMode === "grid" ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" : "space-y-3"
      )}>
        {isLoading ? (
          <div className="col-span-full py-20 text-center space-y-4">
            <Loader2 className="animate-spin mx-auto text-primary" size={32} />
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-neutral-400">Syncing with systemd...</p>
          </div>
        ) : filteredServices?.length === 0 ? (
          <div className="col-span-full py-20 text-center bg-card border border-dashed border-neutral-200 dark:border-neutral-800 rounded-[2rem]">
            <FileQuestion className="mx-auto text-neutral-300 mb-4" size={48} />
            <p className="text-xs font-bold uppercase tracking-widest text-neutral-400">No matching services found</p>
          </div>
        ) : (
          filteredServices?.map((service) => (
            <div 
              key={service.name} 
              className={cn(
                "group bg-card border transition-all duration-300 relative overflow-hidden",
                viewMode === "grid" ? "rounded-[2rem] p-6 flex flex-col justify-between h-full" : "rounded-3xl p-4 flex items-center justify-between",
                service.is_pinned ? "border-primary/30 bg-primary/[0.02] shadow-sm" : "border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 hover:shadow-md"
              )}
            >
              <div className={cn("flex", viewMode === "grid" ? "flex-col" : "items-center flex-1 min-w-0 space-x-4")}>
                {/* Icon & Pin */}
                <div className={cn("flex items-center", viewMode === "grid" ? "justify-between mb-4" : "shrink-0")}>
                  <div className={cn(
                    "p-2.5 rounded-2xl flex items-center justify-center",
                    service.active_state === "active" ? "bg-green-500/10 text-green-500" : "bg-neutral-100 dark:bg-neutral-800 text-neutral-400"
                  )}>
                    <Terminal size={18} />
                  </div>
                  <button 
                    onClick={() => pinMutation.mutate({ name: service.name, pinned: !service.is_pinned })}
                    className={cn(
                      "transition-all active:scale-90",
                      service.is_pinned ? "text-primary" : "text-neutral-300 hover:text-neutral-500",
                      viewMode === "list" && "hidden"
                    )}
                  >
                    <Pin size={16} className={cn(service.is_pinned && "fill-current")} />
                  </button>
                </div>

                {/* Name & Desc */}
                <div className="min-w-0 flex-1">
                   <div className="flex items-center space-x-2">
                      <h3 className="text-sm font-black tracking-tight truncate text-neutral-900 dark:text-white group-hover:text-primary transition-colors">
                        {service.name}
                      </h3>
                      {service.is_pinned && viewMode === "list" && <Pin size={10} className="text-primary fill-current" />}
                   </div>
                   <p className="text-[10px] text-neutral-500 font-bold truncate mt-0.5">
                     {service.description || "No description provided"}
                   </p>
                </div>

                {/* Status Badge */}
                <div className={cn(viewMode === "grid" ? "mt-4" : "mx-4 shrink-0 hidden md:block")}>
                   <StatusBadge state={service.active_state} subState={service.sub_state} loadState={service.load_state} />
                </div>
              </div>

              {/* Actions */}
              <div className={cn(
                "flex items-center space-x-1.5",
                viewMode === "grid" ? "mt-6 border-t border-neutral-100 dark:border-neutral-800 pt-4" : "shrink-0"
              )}>
                 {service.load_state !== "not-found" && (
                   <>
                      <ActionButton 
                        icon={service.active_state === "active" ? Square : Play} 
                        onClick={() => actionMutation.mutate({ name: service.name, action: service.active_state === "active" ? "stop" : "start" })}
                        loading={actionMutation.isPending && actionMutation.variables?.name === service.name}
                        variant={service.active_state === "active" ? "destructive" : "default"}
                      />
                      <ActionButton 
                        icon={RotateCcw} 
                        onClick={() => actionMutation.mutate({ name: service.name, action: "restart" })}
                        loading={actionMutation.isPending && actionMutation.variables?.name === service.name}
                        variant="outline"
                      />
                   </>
                 )}
                 <ActionButton 
                    icon={ChevronRight} 
                    onClick={() => {
                      setSelectedService(service.name);
                      setShowLogs(true);
                    }}
                    variant="outline"
                 />
              </div>
            </div>
          ))
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

function StatCard({ icon: Icon, label, value, color }: any) {
  const colors = {
    blue: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    green: "bg-green-500/10 text-green-500 border-green-500/20",
    red: "bg-red-500/10 text-red-500 border-red-500/20",
    gray: "bg-neutral-500/10 text-neutral-400 border-neutral-500/20",
  };

  return (
    <div className="bg-card border border-neutral-200 dark:border-neutral-800 rounded-[1.5rem] md:rounded-[2rem] p-4 md:p-6 flex items-center space-x-4 shadow-sm hover:shadow-md transition-shadow">
      <div className={cn("p-3 md:p-4 rounded-2xl border", colors[color as keyof typeof colors])}>
        <Icon size={20} className="md:w-6 md:h-6" />
      </div>
      <div className="min-w-0">
        <p className="text-[8px] md:text-[10px] font-black uppercase text-neutral-400 tracking-widest">{label}</p>
        <p className="text-xl md:text-2xl font-black tracking-tight">{value}</p>
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
      <div className="flex items-center space-x-2 px-3 py-1.5 rounded-full border border-neutral-500/20 bg-neutral-500/10 text-neutral-500 text-[10px] font-black uppercase tracking-widest">
        <div className="w-2 h-2 rounded-full bg-neutral-500" />
        <span>Missing</span>
      </div>
    );
  }

  return (
    <div className={cn(
      "flex items-center space-x-2 px-3 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-widest",
      isActive 
        ? "bg-green-500/10 border-green-500/20 text-green-600 dark:text-green-400" 
        : isFailed 
          ? "bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400"
          : "bg-neutral-500/10 border-neutral-500/20 text-neutral-600 dark:text-neutral-400"
    )}>
      <div className={cn(
        "w-2 h-2 rounded-full",
        isActive ? "bg-green-500" : isFailed ? "bg-red-500" : "bg-neutral-500"
      )} />
      <span>{isActive ? "Active" : isFailed ? "Failed" : state}</span>
    </div>
  );
}

function ActionButton({ icon: Icon, onClick, loading, variant = "default" }: any) {
  return (
    <Button 
      variant={variant} 
      size="icon" 
      className="h-10 w-10 md:h-11 md:w-11 rounded-2xl shadow-sm transition-all active:scale-90"
      onClick={onClick}
      disabled={loading}
    >
      {loading ? <Loader2 className="animate-spin" size={16} /> : <Icon size={18} />}
    </Button>
  );
}
