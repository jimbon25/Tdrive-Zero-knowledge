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
  Key
} from "lucide-react";
import toast from "react-hot-toast";

export default function ServerPage() {
  const queryClient = useQueryClient();
  const { isServerUnlocked, setServerUnlocked } = useUIStore();
  const [searchTerm, setSearchTerm] = React.useState("");
  const [selectedService, setSelectedService] = React.useState<string | null>(null);
  const [showLogs, setShowLogs] = React.useState(false);
  const [unlockPassword, setUnlockPassword] = React.useState("");
  const logEndRef = React.useRef<HTMLDivElement>(null);

  // 0. Auto-lock on unmount
  React.useEffect(() => {
    return () => {
      // Optional: uncomment to lock every time user leaves the page
      // setServerUnlocked(false);
    };
  }, [setServerUnlocked]);

  // 1. Fetch Services
  const { data: services, isLoading, isRefetching } = useQuery({
    queryKey: ["server-services"],
    queryFn: async () => {
      const resp = await api.get<StructuredResponse<ServiceStatus[]>>("/system/services");
      return resp.data.data || [];
    },
    refetchInterval: 10000,
    enabled: isServerUnlocked,
  });

  // 2. Fetch Logs
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

  // 3. Unlock Mutation
  const unlockMutation = useMutation({
    mutationFn: async (password: string) => {
      const resp = await api.post<StructuredResponse<boolean>>("/system/unlock", { password });
      return resp.data;
    },
    onSuccess: (data) => {
      if (data.success) {
        setServerUnlocked(true);
        setUnlockPassword("");
        toast.success("Server dashboard unlocked");
      } else {
        toast.error("Invalid Master Password");
      }
    },
    onError: () => {
      toast.error("Verification failed");
    }
  });

  // 4. Service Action Mutation
  const actionMutation = useMutation({
    mutationFn: async ({ name, action }: { name: string, action: string }) => {
      const resp = await api.post(`/system/services/${name}/action`, { action });
      return resp.data;
    },
    onSuccess: (_, variables) => {
      toast.success(`Service ${variables.action}ed successfully`);
      queryClient.invalidateQueries({ queryKey: ["server-services"] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || "Action failed");
    }
  });

  if (!isServerUnlocked) {
    return (
      <div className="h-[70vh] flex items-center justify-center animate-in fade-in zoom-in-95 duration-500">
         <div className="bg-card border border-neutral-200 dark:border-neutral-800 rounded-3xl p-8 w-full max-w-md shadow-2xl space-y-8 text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-primary/20" />
            
            <div className="flex flex-col items-center space-y-4">
               <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center text-primary relative">
                  <Lock size={32} />
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-card flex items-center justify-center">
                     <ShieldAlert size={8} className="text-white" />
                  </div>
               </div>
               <div>
                  <h2 className="text-xl font-black tracking-tight">Access Restricted</h2>
                  <p className="text-xs text-neutral-500 font-medium mt-1 uppercase tracking-widest">Master Password Required</p>
               </div>
            </div>

            <div className="space-y-4">
               <div className="relative">
                  <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" size={16} />
                  <input 
                    type="password"
                    placeholder="Enter Master Password..."
                    value={unlockPassword}
                    onChange={(e) => setUnlockPassword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && unlockMutation.mutate(unlockPassword)}
                    className="w-full bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl pl-12 pr-4 h-12 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                    autoFocus
                  />
               </div>
               <Button 
                className="w-full h-12 rounded-2xl font-black uppercase tracking-widest text-[10px]"
                disabled={!unlockPassword || unlockMutation.isPending}
                onClick={() => unlockMutation.mutate(unlockPassword)}
               >
                  {unlockMutation.isPending ? <Loader2 className="animate-spin" size={16} /> : "Unlock Dashboard"}
               </Button>
            </div>

            <p className="text-[10px] text-neutral-400 font-medium italic">
               Unlocking provides temporary access to systemd services and real-time logs.
            </p>
         </div>
      </div>
    );
  }

  const filteredServices = services?.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    total: services?.length || 0,
    active: services?.filter(s => s.active_state === "active").length || 0,
    failed: services?.filter(s => s.sub_state === "failed").length || 0,
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500 pb-10">
      {/* sudoers Instruction Alert */}
      {actionMutation.isError && (actionMutation.error as any).response?.data?.error?.message?.toLowerCase().includes("sudo") && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex items-start space-x-3 text-amber-600 dark:text-amber-400 animate-in slide-in-from-top-2">
           <AlertCircle size={18} className="shrink-0 mt-0.5" />
           <div className="text-xs space-y-1">
              <p className="font-bold">Permission Denied (Sudo Required)</p>
              <p className="opacity-90">To control services, add this line to your <code>/etc/sudoers</code> file:</p>
              <pre className="bg-black/5 dark:bg-white/5 p-2 rounded mt-2 font-mono text-[10px] overflow-x-auto border border-amber-500/20">
                {`your_user ALL=(ALL) NOPASSWD: /usr/bin/systemctl *`}
              </pre>
           </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-primary/10 text-primary rounded-xl shadow-sm">
            <Server size={20} />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-black tracking-tight">Server Monitor</h1>
              <div className="px-1.5 py-0.5 bg-green-500/10 text-green-500 border border-green-500/20 rounded text-[8px] font-black uppercase tracking-widest">Unlocked</div>
            </div>
            <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest mt-0.5">Manage systemd services and logs</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
           <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={14} />
              <input 
                type="text"
                placeholder="Search services..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-4 h-9 bg-card border border-neutral-200 dark:border-neutral-800 rounded-xl text-xs focus:ring-2 focus:ring-primary/20 outline-none w-full sm:w-64"
              />
           </div>
           <Button variant="outline" size="icon" onClick={() => setServerUnlocked(false)} title="Lock Dashboard">
              <Lock size={14} />
           </Button>
           <Button variant="outline" size="icon" onClick={() => queryClient.invalidateQueries({ queryKey: ["server-services"] })}>
              <RefreshCw size={14} className={cn(isRefetching && "animate-spin")} />
           </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
         <StatCard icon={Activity} label="Total Services" value={stats.total} color="blue" />
         <StatCard icon={CheckCircle2} label="Active Services" value={stats.active} color="green" />
         <StatCard icon={AlertCircle} label="Failed Services" value={stats.failed} color="red" />
      </div>

      {/* Services Table */}
      <div className="bg-card border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50">
                <th className="px-6 py-4 text-[10px] font-black uppercase text-neutral-400 tracking-wider">Service Name</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase text-neutral-400 tracking-wider">Status</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase text-neutral-400 tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {isLoading ? (
                <tr>
                  <td colSpan={3} className="px-6 py-12 text-center text-neutral-400">
                    <Loader2 className="animate-spin mx-auto mb-2" size={20} />
                    <p className="text-xs font-bold uppercase tracking-widest">Loading services...</p>
                  </td>
                </tr>
              ) : filteredServices?.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-12 text-center text-neutral-400">
                    <p className="text-xs font-bold uppercase tracking-widest">No services found</p>
                  </td>
                </tr>
              ) : (
                filteredServices?.map((service) => (
                  <tr key={service.name} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-900/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-neutral-900 dark:text-neutral-100 truncate max-w-[200px] sm:max-w-md">
                          {service.name}
                        </span>
                        <span className="text-[10px] text-neutral-500 font-medium truncate max-w-[200px] sm:max-w-md">
                          {service.description}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                       <div className="flex items-center space-x-2">
                          <StatusBadge state={service.active_state} subState={service.sub_state} />
                       </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                       <div className="flex items-center justify-end space-x-1">
                          {service.active_state === "active" ? (
                            <ActionButton 
                              icon={Square} 
                              onClick={() => actionMutation.mutate({ name: service.name, action: "stop" })}
                              loading={actionMutation.isPending && actionMutation.variables?.name === service.name}
                              variant="destructive"
                              title="Stop"
                            />
                          ) : (
                            <ActionButton 
                              icon={Play} 
                              onClick={() => actionMutation.mutate({ name: service.name, action: "start" })}
                              loading={actionMutation.isPending && actionMutation.variables?.name === service.name}
                              variant="default"
                              title="Start"
                            />
                          )}
                          <ActionButton 
                            icon={RotateCcw} 
                            onClick={() => actionMutation.mutate({ name: service.name, action: "restart" })}
                            loading={actionMutation.isPending && actionMutation.variables?.name === service.name}
                            variant="outline"
                            title="Restart"
                          />
                          <ActionButton 
                            icon={Terminal} 
                            onClick={() => {
                              setSelectedService(service.name);
                              setShowLogs(true);
                            }}
                            variant="outline"
                            title="Logs"
                          />
                       </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Log Viewer Modal */}
      {showLogs && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
           <div className="bg-neutral-950 border border-neutral-800 w-full max-w-4xl h-[80vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-900/50">
                 <div className="flex items-center space-x-3">
                    <Terminal size={18} className="text-primary" />
                    <div>
                       <h3 className="text-sm font-bold text-white tracking-tight">{selectedService}</h3>
                       <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest">Live Journal Logs</p>
                    </div>
                 </div>
                 <button 
                  onClick={() => setShowLogs(false)}
                  className="p-2 hover:bg-neutral-800 rounded-lg text-neutral-400 hover:text-white transition-colors"
                 >
                    <X size={18} />
                 </button>
              </div>

              <div className="flex-1 p-6 overflow-y-auto font-mono text-[11px] leading-relaxed scrollbar-thin scrollbar-thumb-neutral-800 scrollbar-track-transparent">
                 {logsLoading && !logsData ? (
                   <div className="h-full flex flex-col items-center justify-center space-y-3 text-neutral-500">
                      <Loader2 className="animate-spin" size={24} />
                      <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Fetching Logs...</span>
                   </div>
                 ) : (
                   <div className="space-y-1">
                      {logsData?.logs.map((log, i) => (
                        <div key={i} className="text-neutral-300 hover:bg-white/5 transition-colors px-1 rounded">
                           <span className="text-neutral-600 mr-4 select-none inline-block w-4 text-right">{i + 1}</span>
                           <span className="break-all">{log}</span>
                        </div>
                      ))}
                      <div ref={logEndRef} />
                      {logsData?.logs.length === 0 && <p className="text-neutral-500 italic text-center py-10">No logs found for this service.</p>}
                   </div>
                 )}
              </div>

              <div className="px-6 py-4 border-t border-neutral-800 bg-neutral-900/50 flex justify-between items-center">
                 <div className="flex items-center space-x-3">
                    <div className="flex items-center space-x-1">
                       <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                       <p className="text-[9px] font-black text-neutral-500 uppercase tracking-widest">Live Updates (3s)</p>
                    </div>
                 </div>
                 <Button size="sm" variant="outline" className="h-8 border-neutral-700 text-neutral-300 hover:bg-neutral-800" onClick={() => queryClient.invalidateQueries({ queryKey: ["service-logs", selectedService] })}>
                    <RefreshCw size={12} className="mr-2" />
                    Refresh
                 </Button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}

// --- HELPERS ---

function StatCard({ icon: Icon, label, value, color }: any) {
  const colors = {
    blue: "bg-blue-500/10 text-blue-500",
    green: "bg-green-500/10 text-green-500",
    red: "bg-red-500/10 text-red-500",
  };

  return (
    <div className="bg-card border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 flex items-center space-x-4 shadow-sm">
      <div className={cn("p-3 rounded-xl", colors[color as keyof typeof colors])}>
        <Icon size={20} />
      </div>
      <div>
        <p className="text-[10px] font-black uppercase text-neutral-400 tracking-wider">{label}</p>
        <p className="text-xl font-black">{value}</p>
      </div>
    </div>
  );
}

function StatusBadge({ state, subState }: { state: string, subState: string }) {
  const isActive = state === "active";
  const isFailed = subState === "failed";

  return (
    <div className={cn(
      "flex items-center space-x-1.5 px-2.5 py-1 rounded-full border text-[10px] font-black uppercase tracking-tight",
      isActive 
        ? "bg-green-500/10 border-green-500/20 text-green-600 dark:text-green-400" 
        : isFailed 
          ? "bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400"
          : "bg-neutral-500/10 border-neutral-500/20 text-neutral-600 dark:text-neutral-400"
    )}>
      <div className={cn(
        "w-1.5 h-1.5 rounded-full",
        isActive ? "bg-green-500" : isFailed ? "bg-red-500" : "bg-neutral-500"
      )} />
      <span>{isActive ? "Active" : isFailed ? "Failed" : state}</span>
      {isActive && subState !== "running" && <span className="opacity-60 lowercase font-medium">({subState})</span>}
    </div>
  );
}

function ActionButton({ icon: Icon, onClick, loading, variant = "default", title }: any) {
  return (
    <Button 
      variant={variant} 
      size="icon" 
      className="h-8 w-8 rounded-lg"
      onClick={onClick}
      disabled={loading}
      title={title}
    >
      {loading ? <Loader2 className="animate-spin" size={12} /> : <Icon size={12} />}
    </Button>
  );
}
