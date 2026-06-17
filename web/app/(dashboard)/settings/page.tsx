"use client";

import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import { SystemStatus, StructuredResponse } from "@/types";
import { Button, cn } from "@/components/ui";
import { useNotificationStore } from "@/store/useNotificationStore";
import { useUIStore, ThemeMode, AccentColor, UIDensity } from "@/store/useUIStore";
import { 
  Settings, 
  Shield, 
  Database, 
  Send, 
  RefreshCw, 
  Trash2, 
  Loader2, 
  HardDrive, 
  Lock,
  Terminal,
  Palette,
  Sun,
  Moon,
  Monitor,
  Check,
  Maximize,
  Minimize,
  Bot
} from "lucide-react";
import toast from "react-hot-toast";

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [botTokenInput, setBotToken] = React.useState("");
  const [authorizedUsersInput, setAuthorizedUsersInput] = React.useState("");
  const [isAuthUsersDirty, setIsAuthUsersDirty] = React.useState(false);
  const { confirm, addNotification } = useNotificationStore();
  const { 
    themeMode, setThemeMode, 
    accentColor, setAccentColor, 
    density, setDensity 
  } = useUIStore();

  const { data: status, isLoading } = useQuery({
    queryKey: ["system-status"],
    queryFn: async () => {
      const resp = await api.get<StructuredResponse<SystemStatus>>("/system/status");
      return resp.data.data;
    },
    refetchInterval: 10000,
  });

  const rebuildMutation = useMutation({
    mutationFn: async () => await api.post("/system/rebuild"),
    onSuccess: () => {
      toast.success("Index rebuild started");
      addNotification({ type: "info", title: "Rebuild Started", message: "Scanning Telegram channel..." });
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
    },
  });

  const cleanupMutation = useMutation({
    mutationFn: async () => {
      const resp = await api.post("/system/cleanup");
      return resp.data;
    },
    onSuccess: () => {
       toast.success("Cleanup successful");
       addNotification({ type: "success", title: "Cleanup Complete", message: "System optimized." });
    },
  });

  const healMutation = useMutation({
    mutationFn: async () => {
      const resp = await api.post("/system/heal");
      return resp.data;
    },
    onSuccess: (data: any) => {
       toast.success(`Healing complete: ${data.data.healed_count} items materialized`);
       addNotification({ type: "success", title: "Materialization Complete", message: `Restored metadata for ${data.data.healed_count} items.` });
       queryClient.invalidateQueries({ queryKey: ["files"] });
    },
  });

  const toggleFeature = useMutation({
    mutationFn: async ({ name, enabled }: { name: string, enabled: boolean }) => 
      await api.post(`/system/features/${name}?enabled=${enabled}`),
    onSuccess: () => {
      toast.success("Settings updated");
      queryClient.invalidateQueries({ queryKey: ["system-status"] });
    }
  });

  const updateBotToken = useMutation({
    mutationFn: async (token: string) => await api.post(`/system/config/bot-token?token=${encodeURIComponent(token)}`),
    onSuccess: () => {
      toast.success("Bot token saved");
      setBotToken("");
    }
  });

  const updateAuthorizedUsers = useMutation({
    mutationFn: async (users: string) => await api.post(`/system/config/bot-authorized-users?users=${encodeURIComponent(users)}`),
    onSuccess: () => {
      toast.success("Authorized users updated");
      setIsAuthUsersDirty(false);
      queryClient.invalidateQueries({ queryKey: ["system-status"] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || "Failed to update authorized users");
    }
  });

  React.useEffect(() => {
    if (status?.bot?.authorized_users && !isAuthUsersDirty) {
      setAuthorizedUsersInput(status.bot.authorized_users.join(", "));
    }
  }, [status, isAuthUsersDirty]);

  const toggleDevMode = useMutation({
    mutationFn: async (enabled: boolean) => await api.post(`/developer/config/dev-mode?enabled=${enabled}`),
    onSuccess: () => {
      toast.success("Developer mode updated");
      queryClient.invalidateQueries({ queryKey: ["system-status"] });
    }
  });

  const isBotEnabled = status?.features?.optional?.find(f => f.id === "F-OPT-04")?.enabled;

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 pb-10">
      {/* 1. Header */}
      <div className="flex items-center space-x-3 text-neutral-900 dark:text-neutral-100">
        <div className="p-2 bg-primary/10 text-primary rounded-xl shadow-sm">
          <Settings size={20} />
        </div>
        <div>
          <h1 className="text-xl font-black tracking-tight">Preferences</h1>
          <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest mt-0.5">Personalize your cloud experience</p>
        </div>
      </div>

      {/* 2. Visual Appearance Section */}
      <section className="space-y-4">
        <div className="flex items-center space-x-2 px-1">
           <Palette size={14} className="text-primary" />
           <h2 className="text-[10px] font-black uppercase text-neutral-400 tracking-[0.2em]">Visual Appearance</h2>
        </div>
        
        <div className="bg-card border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-sm overflow-hidden">
           {/* Section 1: Interface Theme */}
           <div className="p-5 sm:p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                 <div>
                    <h3 className="font-bold text-sm">Interface Theme</h3>
                    <p className="text-xs text-neutral-500 mt-0.5">Choose how TDrive looks to you.</p>
                 </div>
                 <div className="grid grid-cols-3 gap-1 p-1 bg-neutral-100 dark:bg-neutral-800/50 rounded-xl w-full sm:w-64">
                    {(["light", "dark", "system"] as ThemeMode[]).map((mode) => (
                       <button
                         key={mode}
                         onClick={() => setThemeMode(mode)}
                         className={cn(
                           "flex items-center justify-center space-x-2 py-1.5 rounded-lg transition-all",
                           themeMode === mode ? "bg-card text-primary shadow-sm" : "text-neutral-500 hover:text-foreground"
                         )}
                       >
                          {mode === "light" && <Sun size={12} />}
                          {mode === "dark" && <Moon size={12} />}
                          {mode === "system" && <Monitor size={12} />}
                          <span className="text-[10px] font-bold uppercase tracking-tight">{mode}</span>
                       </button>
                    ))}
                 </div>
              </div>
           </div>

           <div className="border-t border-neutral-100 dark:border-neutral-800" />

           {/* Section 2: Accent & Density Grid */}
           <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-neutral-100 dark:divide-neutral-800">
              {/* Accent Color */}
              <div className="p-5 sm:p-6 space-y-4">
                 <h3 className="font-bold text-sm">Accent Color</h3>
                 <div className="flex items-center space-x-3">
                    {(["blue", "green", "purple"] as AccentColor[]).map((color) => (
                       <button
                         key={color}
                         onClick={() => setAccentColor(color)}
                         className={cn(
                           "w-7 h-7 rounded-full flex items-center justify-center transition-all border-2",
                           accentColor === color ? "border-primary scale-110 shadow-sm" : "border-transparent opacity-60 hover:opacity-100 hover:scale-105"
                         )}
                         style={{ 
                           backgroundColor: color === "blue" ? "#3b82f6" : color === "green" ? "#10b981" : "#8b5cf6" 
                         }}
                       >
                          {accentColor === color && <Check size={12} className="text-white" />}
                       </button>
                    ))}
                 </div>
              </div>

              {/* Layout Density */}
              <div className="p-5 sm:p-6 space-y-4">
                 <div className="flex items-center justify-between">
                    <h3 className="font-bold text-sm">Layout Density</h3>
                    <div className="flex bg-neutral-100 dark:bg-neutral-800/50 p-1 rounded-xl">
                       {(["comfortable", "compact"] as UIDensity[]).map((d) => (
                          <button
                            key={d}
                            onClick={() => setDensity(d)}
                            className={cn(
                              "flex items-center space-x-1.5 px-3 py-1 rounded-lg text-[10px] font-bold capitalize transition-all",
                              density === d ? "bg-card text-primary shadow-sm" : "text-neutral-500 hover:text-foreground"
                            )}
                          >
                             {d === "comfortable" ? <Maximize size={10} /> : <Minimize size={10} />}
                             <span>{d}</span>
                          </button>
                       ))}
                    </div>
                 </div>
                 <p className="text-[11px] text-neutral-500">Adjust the density of the file list.</p>
              </div>
           </div>
        </div>
      </section>

      {/* 3. Bot Configuration */}
      <section className="space-y-4">
        <div className="flex items-center space-x-2 px-1">
           <Bot size={14} className="text-primary" />
           <h2 className="text-[10px] font-black uppercase text-neutral-400 tracking-[0.2em]">Telegram Bot Interface</h2>
        </div>
        
        <div className="bg-card border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 space-y-6 shadow-sm">
           <div className="flex items-center justify-between">
              <div>
                 <h3 className="font-bold text-sm">Enable Bot Access</h3>
                 <p className="text-xs text-neutral-500 mt-1">Control files via your own Telegram Bot.</p>
              </div>
              <button 
                onClick={() => toggleFeature.mutate({ name: "bot_interface", enabled: !isBotEnabled })}
                className={cn(
                  "w-12 h-6 rounded-full transition-colors relative",
                  isBotEnabled ? "bg-primary" : "bg-neutral-200 dark:bg-neutral-800"
                )}
              >
                 <div className={cn(
                    "absolute top-1 w-4 h-4 bg-white rounded-full transition-transform",
                    isBotEnabled ? "left-7" : "left-1"
                 )} />
              </button>
           </div>

            {isBotEnabled && status?.bot && (
              <div className="space-y-3">
                <div className="flex items-center space-x-3 p-3 bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-100 dark:border-neutral-800 rounded-xl">
                   <div className={cn(
                     "w-2 h-2 rounded-full",
                     status.bot.is_active ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]" : "bg-red-500"
                   )} />
                   <div className="flex-1">
                      <p className="text-[10px] font-black uppercase text-neutral-400">Bot Status</p>
                      <p className="text-xs font-bold">
                         {status.bot.is_active ? "Connected & Online" : "Disconnected"}
                         {status.bot.username && <span className="ml-2 text-primary">@{status.bot.username}</span>}
                      </p>
                   </div>
                </div>

                {status.bot.has_authorized_user ? (
                  <div className="flex flex-col space-y-2 p-3 bg-green-500/5 border border-green-500/10 rounded-xl">
                    <div className="flex items-center space-x-2 text-xs text-green-600 dark:text-green-400 font-bold">
                       <span>✓ Authorized Users</span>
                    </div>
                    <div className="space-y-1">
                      {status.bot.authorized_user_details?.map((user: any) => (
                        <div key={user.id} className="flex items-center justify-between text-[11px] bg-white/50 dark:bg-black/20 p-1.5 px-2 rounded-lg border border-neutral-100 dark:border-neutral-800">
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-neutral-700 dark:text-neutral-300">
                              {user.username ? `@${user.username}` : (user.first_name || user.id)}
                            </span>
                            {user.first_name && (
                              <span className="text-neutral-400">
                                ({user.first_name}{user.last_name ? ` ${user.last_name}` : ''})
                              </span>
                            )}
                          </div>
                          <span className="text-[9px] font-mono text-neutral-400">ID: {user.id}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col space-y-1 p-3 bg-amber-500/5 border border-amber-500/10 text-amber-700 dark:text-amber-400 rounded-xl text-xs font-medium">
                    <span className="font-bold flex items-center space-x-1">
                      <span>⚠ No Authorized User Configured</span>
                    </span>
                    <span className="text-[10px] opacity-80">
                      No Authorized User configured. Bot is publicly accessible.
                    </span>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-3">
               <label className="text-[10px] font-black uppercase text-neutral-400">Bot Token (from @BotFather)</label>
               <div className="flex gap-2">
                  <input 
                    type="password"
                    placeholder="123456:ABC-DEF..."
                    value={botTokenInput}
                    onChange={(e) => setBotToken(e.target.value)}
                    className="flex-1 bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 h-10 text-xs focus:ring-2 focus:ring-primary/20 outline-none"
                  />
                  <Button 
                    className="h-10 px-6 rounded-xl font-bold text-xs"
                    disabled={!botTokenInput || updateBotToken.isPending}
                    onClick={() => updateBotToken.mutate(botTokenInput)}
                  >
                     {updateBotToken.isPending ? <Loader2 className="animate-spin" size={14} /> : "Save Token"}
                  </Button>
               </div>
            </div>

            <div className="space-y-3">
               <label className="text-[10px] font-black uppercase text-neutral-400">Authorized Telegram User ID(s)</label>
               <div className="flex gap-2">
                  <input 
                    type="text"
                    placeholder="e.g. 123456789, 987654321"
                    value={authorizedUsersInput}
                    onChange={(e) => {
                      setAuthorizedUsersInput(e.target.value);
                      setIsAuthUsersDirty(true);
                    }}
                    className="flex-1 bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 h-10 text-xs focus:ring-2 focus:ring-primary/20 outline-none"
                  />
                  <Button 
                    className="h-10 px-6 rounded-xl font-bold text-xs"
                    disabled={updateAuthorizedUsers.isPending}
                    onClick={() => {
                      const rawInput = authorizedUsersInput.trim();
                      if (rawInput) {
                        const parts = rawInput.replace(/,/g, "\n").split("\n");
                        for (const part of parts) {
                          const clean = part.trim();
                          if (clean && !/^\d+$/.test(clean)) {
                            toast.error(`Invalid User ID: "${clean}". User ID must be numeric.`);
                            return;
                          }
                        }
                      }
                      updateAuthorizedUsers.mutate(authorizedUsersInput);
                    }}
                  >
                     {updateAuthorizedUsers.isPending ? <Loader2 className="animate-spin" size={14} /> : "Save Users"}
                  </Button>
               </div>
               <p className="text-[10px] text-neutral-500 font-medium">
                  Separate multiple Telegram User IDs with commas or newlines. Leave empty for open access.
               </p>
            </div>
         </div>
      </section>

      {/* 4. Status Overview */}
      <section className="space-y-4">
        <h2 className="text-[10px] font-bold uppercase text-neutral-400 tracking-[0.2em] px-1">Infrastructure Health</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatusCard icon={Send} label="MTProto" value={status?.telegram_connected ? "OK" : "Error"} ok={!!status?.telegram_connected} />
          <StatusCard icon={Database} label="Index" value={status?.sqlite_healthy ? "OK" : "Bad"} ok={!!status?.sqlite_healthy} />
          <StatusCard icon={Shield} label="Auth" value={status?.session_valid ? "Valid" : "None"} ok={!!status?.session_valid} />
          <StatusCard icon={HardDrive} label="Storage" value={status?.channel_accessible ? "Live" : "Miss"} ok={!!status?.channel_accessible} />
        </div>
      </section>

      {/* 5. Administrative Section */}
      <section className="space-y-4">
        <h2 className="text-[10px] font-bold uppercase text-neutral-400 tracking-[0.2em] px-1">Administrative Utilities</h2>
        <div className="bg-card border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden shadow-sm">
          <AdminAction 
            icon={RefreshCw} 
            title="Rebuild Metadata Index" 
            desc="Deep scan Telegram for missing file records."
            btnLabel="Run Scan"
            onClick={async () => {
              if (await confirm({ title: "Rebuild Index?", message: "This will scan your entire Telegram channel." })) rebuildMutation.mutate();
            }}
            loading={rebuildMutation.isPending}
          />
          <AdminAction 
            icon={Trash2} 
            title="Maintenance Cleanup" 
            desc="Purge orphans and local temporary files."
            btnLabel="Clean Drive"
            variant="destructive"
            onClick={async () => {
              if (await confirm({ title: "Clean Drive?", message: "This will permanently delete orphaned assets." })) cleanupMutation.mutate();
            }}
            loading={cleanupMutation.isPending}
          />
          <AdminAction 
            icon={Palette} 
            title="Heal File Metadata" 
            desc="Regenerate missing thumbnails and verify integrity."
            btnLabel="Heal Now"
            onClick={async () => {
              if (await confirm({ title: "Heal Metadata?", message: "This will download files to restore thumbnails. May take a while." })) healMutation.mutate();
            }}
            loading={healMutation.isPending}
          />
          <AdminAction 
            icon={Terminal} 
            title="Developer Mode" 
            desc="Enable real-time logs and performance metrics."
            btnLabel={status?.dev_mode ? "Disable Console" : "Enable Console"}
            variant={status?.dev_mode ? "destructive" : "default"}
            onClick={() => toggleDevMode.mutate(!status?.dev_mode)}
            loading={toggleDevMode.isPending}
          />
        </div>
      </section>

      {/* Footer Branding */}
      <footer className="pt-6 text-center space-y-3">
         <div className="w-8 h-8 bg-neutral-100 dark:bg-neutral-800 rounded-xl mx-auto flex items-center justify-center text-neutral-300">
            <Lock size={16} />
         </div>
         <p className="text-[9px] font-black text-neutral-400 uppercase tracking-[0.4em]">
            TDrive Agent • Build 1.4.0 • Build with DLA
         </p>
      </footer>
    </div>
  );
}

// --- HELPERS ---

function StatusCard({ icon: Icon, label, value, ok }: any) {
  return (
    <div className="bg-card border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 space-y-2 relative overflow-hidden group">
      <div className={cn("p-2 rounded-lg w-fit transition-colors", ok ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500")}>
        <Icon size={14} />
      </div>
      <div>
        <p className="text-[8px] font-black uppercase text-neutral-400 tracking-tighter">{label}</p>
        <p className="text-xs font-bold truncate">{value}</p>
      </div>
      <div className={cn("absolute top-3 right-3 w-1 h-1 rounded-full", ok ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" : "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]")} />
    </div>
  );
}

function AdminAction({ icon: Icon, title, desc, btnLabel, onClick, loading, variant = "default" }: any) {
  return (
    <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b last:border-b-0 border-neutral-100 dark:border-neutral-800 hover:bg-neutral-50/50 dark:hover:bg-neutral-900/50 transition-all group">
      <div className="flex items-center space-x-4">
        <div className="p-2.5 bg-neutral-100 dark:bg-neutral-800 rounded-lg group-hover:bg-primary/10 group-hover:text-primary transition-colors">
          <Icon size={18} />
        </div>
        <div>
          <h4 className="font-bold text-sm tracking-tight">{title}</h4>
          <p className="text-[11px] text-neutral-500 font-medium max-w-sm mt-0.5">{desc}</p>
        </div>
      </div>
      <Button 
        variant={variant as any} 
        className="rounded-lg h-8 px-4 text-xs font-bold shadow-sm"
        onClick={onClick}
        disabled={loading}
      >
        {loading ? <Loader2 className="animate-spin" size={14} /> : btnLabel}
      </Button>
    </div>
  );
}
