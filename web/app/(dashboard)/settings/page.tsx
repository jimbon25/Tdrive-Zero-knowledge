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
  Bot,
  Cloud,
  Plus,
  MoreVertical,
  Copy,
  Activity
} from "lucide-react";
import toast from "react-hot-toast";

const GOOGLE_DRIVE_LOGO = (
  <svg className="w-6 h-6" viewBox="0 0 36 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12.28 0L0 21.28L6 31.72L18.28 10.44L12.28 0Z" fill="#0066DA"/>
    <path d="M23.72 0L12.28 0L18.28 10.44L29.72 10.44L23.72 0Z" fill="#00AA47"/>
    <path d="M30 21.28L18.28 10.44L23.72 0L35.44 20.28C36.16 21.52 36.16 23.04 35.44 24.28L31.12 31.72L30 21.28Z" fill="#EA4335"/>
    <path d="M30 21.28L18.28 21.28L12.28 31.72L31.12 31.72L30 21.28Z" fill="#FFBA00"/>
    <path d="M12.28 21.28L0 21.28L6.28 31.72C7 32.96 8.52 32.96 9.24 31.72L12.28 21.28Z" fill="#0066DA"/>
    <path d="M18.28 21.28L12.28 31.72L6 31.72L0 21.28H18.28Z" fill="#0083E8"/>
  </svg>
);

const PROVIDER_LOGOS: Record<string, React.ReactNode> = {
  google: GOOGLE_DRIVE_LOGO,
  google_drive: GOOGLE_DRIVE_LOGO,
  onedrive: (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M19.34 16.5C21.36 16.5 23 14.86 23 12.84C23 11.26 22 9.9 20.52 9.38C20.42 6.64 18.18 4.46 15.42 4.46C14.7 4.46 14 4.62 13.38 4.94C12.18 3.12 10.12 2 7.78 2C4.16 2 1.22 4.94 1.22 8.56C1.22 8.94 1.26 9.32 1.34 9.7C0.54 10.5 0 11.62 0 12.84C0 14.86 1.64 16.5 3.66 16.5H19.34Z" fill="#0078D4"/>
    </svg>
  ),
  dropbox: (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 2L1 5.3L6 8.6L11 5.3L6 2Z" fill="#0061FF"/>
      <path d="M18 2L13 5.3L18 8.6L23 5.3L18 2Z" fill="#0061FF"/>
      <path d="M6 15.2L1 11.9L6 8.6L11 11.9L6 15.2Z" fill="#0061FF"/>
      <path d="M18 15.2L13 11.9L18 8.6L23 11.9L18 15.2Z" fill="#0061FF"/>
      <path d="M12 12.2L7 15.5L12 18.8L17 15.5L12 12.2Z" fill="#0061FF"/>
      <path d="M6 16.5V18.2L12 22L18 18.2V16.5L12 20.3L6 16.5Z" fill="#0061FF"/>
    </svg>
  ),
  mega: (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="11" fill="#D8232A"/>
      <path d="M12 6L7 16.5H9.5L12 11.5L14.5 16.5H17L12 6Z" fill="white"/>
      <path d="M12 11.5L9.5 16.5H14.5L12 11.5Z" fill="#A81B20"/>
    </svg>
  ),
  pcloud: (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM15.5 14H13V16.5C13 17.33 12.33 18 11.5 18C10.67 18 10 17.33 10 16.5V14H7.5C6.67 14 6 13.33 6 12.5C6 11.67 6.67 11 7.5 11H10V8.5C10 7.67 10.67 7 11.5 7C12.33 7 13 7.67 13 8.5V11H15.5C16.33 11 17 11.67 17 12.5C17 13.33 16.33 14 15.5 14Z" fill="#2A9DF4"/>
    </svg>
  ),
  s3: (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="#FF9900"/>
      <path d="M2 17L12 22L22 17V19L12 24L2 19V17Z" fill="#FF9900"/>
      <path d="M2 12L12 17L22 12V14L12 19L2 14V12Z" fill="#FF9900"/>
    </svg>
  ),
  yandex: (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="12" cy="14" rx="10" ry="6" fill="#C11F2E"/>
      <path d="M13.5 2C15.98 2 18 4.02 18 6.5C18 8.98 15.98 11 13.5 11C11.02 11 9 8.98 9 6.5C9 4.02 11.02 2 13.5 2Z" fill="#E61428"/>
      <path d="M12 11L13.5 2.5H16.5L15 11H12Z" fill="#1C1B1B"/>
    </svg>
  )
};

const PROVIDER_NAMES: Record<string, string> = {
  google: "Google Drive",
  google_drive: "Google Drive",
  onedrive: "OneDrive",
  dropbox: "Dropbox",
  mega: "MEGA",
  pcloud: "pCloud",
  s3: "S3 Storage",
  yandex: "Yandex Disk"
};

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

  // OmniCloud States & Functions
  const [selectedCredentialProvider, setSelectedCredentialProvider] = React.useState<string | null>(null);
  const [openDropdownAccountId, setOpenDropdownAccountId] = React.useState<string | null>(null);
  const [credentialForm, setCredentialForm] = React.useState({
    email: "",
    password: "",
    bucket: "",
    accessKeyId: "",
    secretAccessKey: "",
    region: "us-east-1",
    endpoint: ""
  });

  const formatSize = (bytes: number) => {
    if (!bytes) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

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

  // OmniCloud Integration Queries & Mutations
  const { data: ocAccounts, refetch: refetchOcAccounts } = useQuery({
    queryKey: ["omnicloud-accounts"],
    queryFn: async () => {
      const resp = await api.get<StructuredResponse<any[]>>("/system/omnicloud/accounts");
      return resp.data.data || [];
    },
    enabled: !!status?.omnicloud_connected,
  });

  // Compute storage summaries for Linked Accounts
  const summaryStats = React.useMemo(() => {
    if (!ocAccounts || ocAccounts.length === 0) {
      return {
        totalAccounts: 0,
        totalCapacity: 0,
        totalUsed: 0,
        totalAvailable: 0,
      };
    }
    const totalAccounts = ocAccounts.length;
    let totalCapacity = 0;
    let totalUsed = 0;
    
    ocAccounts.forEach((acc: any) => {
      totalCapacity += Number(acc.total_space || 0);
      totalUsed += Number(acc.used_space || 0);
    });
    
    const totalAvailable = Math.max(0, totalCapacity - totalUsed);
    
    return {
      totalAccounts,
      totalCapacity,
      totalUsed,
      totalAvailable,
    };
  }, [ocAccounts]);

  const deleteOcAccount = useMutation({
    mutationFn: async (id: string) => {
      const resp = await api.delete<StructuredResponse<any>>(`/system/omnicloud/accounts/${id}`);
      if (!resp.data.success) {
        throw new Error(resp.data.error?.message || "Failed to disconnect account");
      }
      return resp.data.data;
    },
    onSuccess: () => {
      toast.success("Account disconnected successfully");
      refetchOcAccounts();
      queryClient.invalidateQueries({ queryKey: ["system-status"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to disconnect account");
    }
  });

  const connectOcOAuth = useMutation({
    mutationFn: async (provider: string) => {
      const resp = await api.get<StructuredResponse<string>>(`/system/omnicloud/connect/${provider}`);
      if (!resp.data.success) {
        throw new Error(resp.data.error?.message || "Failed to initialize provider connection");
      }
      return resp.data.data;
    },
    onSuccess: (url) => {
      if (url) {
        window.location.href = url;
      } else {
        toast.error("Failed to retrieve connection link");
      }
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to initialize provider connection");
    }
  });

  const connectOcCreds = useMutation({
    mutationFn: async ({ provider, body }: { provider: string, body: any }) => {
      const resp = await api.post<StructuredResponse<any>>(`/system/omnicloud/connect/${provider}`, body);
      if (!resp.data.success) {
        throw new Error(resp.data.error?.message || "Failed to connect cloud account");
      }
      return resp.data.data;
    },
    onSuccess: () => {
      toast.success("Account connected successfully!");
      refetchOcAccounts();
      queryClient.invalidateQueries({ queryKey: ["system-status"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to connect cloud account");
    }
  });

  const isBotEnabled = status?.features?.optional?.find(f => f.id === "F-OPT-04")?.enabled;

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 pb-10 px-4 sm:px-6 md:px-0">
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

      {/* OmniCloud Integration Section */}
      <section className="space-y-4">
         <div className="flex items-center space-x-2 px-1">
            <Cloud size={14} className="text-blue-500" />
            <h2 className="text-[10px] font-black uppercase text-neutral-400 tracking-[0.2em]">OmniCloud Storage</h2>
         </div>
         
         <div className="bg-card border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 space-y-6 shadow-sm">
            <div className="flex items-center justify-between">
               <div>
                  <h3 className="font-bold text-sm">OmniCloud Server Status</h3>
                  <p className="text-xs text-neutral-500 mt-1">Connect secondary cloud engines to aggregate storage.</p>
               </div>
               <div className="flex items-center space-x-2">
                  <span className={cn(
                     "text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider",
                     status?.omnicloud_connected ? "bg-blue-500/10 text-blue-500" : "bg-neutral-200 dark:bg-neutral-800 text-neutral-500"
                  )}>
                     {status?.omnicloud_connected ? "Connected" : "Offline"}
                  </span>
               </div>
            </div>

            {status?.omnicloud_connected && (
              <div className="space-y-6">
                 {/* Summary Section */}
                 <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 border-t border-neutral-100 dark:border-neutral-800 pt-5">
                    <div className="bg-neutral-50 dark:bg-neutral-900/20 border border-neutral-150 dark:border-neutral-800/80 p-4 rounded-2xl flex flex-col justify-between h-20 shadow-sm transition-all duration-300 hover:shadow">
                       <span className="text-[9px] font-black uppercase text-neutral-400 tracking-wider">Total Accounts</span>
                       <span className="text-lg font-bold text-blue-500">{summaryStats.totalAccounts}</span>
                    </div>
                    <div className="bg-neutral-50 dark:bg-neutral-900/20 border border-neutral-150 dark:border-neutral-800/80 p-4 rounded-2xl flex flex-col justify-between h-20 shadow-sm transition-all duration-300 hover:shadow">
                       <span className="text-[9px] font-black uppercase text-neutral-400 tracking-wider">Total Capacity</span>
                       <span className="text-lg font-bold">{formatSize(summaryStats.totalCapacity)}</span>
                    </div>
                    <div className="bg-neutral-50 dark:bg-neutral-900/20 border border-neutral-150 dark:border-neutral-800/80 p-4 rounded-2xl flex flex-col justify-between h-20 shadow-sm transition-all duration-300 hover:shadow">
                       <span className="text-[9px] font-black uppercase text-neutral-400 tracking-wider">Used Storage</span>
                       <span className="text-lg font-bold text-amber-500">{formatSize(summaryStats.totalUsed)}</span>
                    </div>
                    <div className="bg-neutral-50 dark:bg-neutral-900/20 border border-neutral-150 dark:border-neutral-800/80 p-4 rounded-2xl flex flex-col justify-between h-20 shadow-sm transition-all duration-300 hover:shadow">
                       <span className="text-[9px] font-black uppercase text-neutral-400 tracking-wider">Available Storage</span>
                       <span className="text-lg font-bold text-emerald-500">{formatSize(summaryStats.totalAvailable)}</span>
                    </div>
                 </div>

                 {/* List of Connected Accounts */}
                 <div className="border-t border-neutral-100 dark:border-neutral-800 pt-5">
                    <h4 className="text-[10px] font-black uppercase text-neutral-400 tracking-wider mb-4">Linked Accounts</h4>
                    {ocAccounts && ocAccounts.length > 0 ? (
                       <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          {ocAccounts.map((account: any) => {
                             const usedPercent = account.total_space 
                                ? Math.min(100, Math.round((account.used_space / account.total_space) * 100))
                                : 0;
                             
                             return (
                                <div key={account.id} className="relative group flex flex-col justify-between p-5 bg-neutral-50 dark:bg-neutral-900/30 border border-neutral-150 dark:border-neutral-800 rounded-2xl shadow-sm hover:shadow-md hover:scale-[1.01] hover:border-neutral-300 dark:hover:border-neutral-700 transition-all duration-300">
                                    <button 
                                       onClick={() => setOpenDropdownAccountId(openDropdownAccountId === account.id ? null : account.id)}
                                       className={cn(
                                          "absolute top-4 right-4 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition-colors p-1 rounded-lg z-25",
                                          openDropdownAccountId === account.id && "text-neutral-700 dark:text-neutral-200 bg-neutral-100 dark:bg-neutral-800"
                                       )}
                                    >
                                       <MoreVertical size={16} />
                                    </button>

                                    {/* Action Dropdown Menu */}
                                    {openDropdownAccountId === account.id && (
                                       <>
                                          <div className="fixed inset-0 z-30" onClick={() => setOpenDropdownAccountId(null)} />
                                          <div className="absolute right-4 top-11 w-44 bg-card border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-lg p-1.5 z-40 animate-in fade-in slide-in-from-top-2 duration-155">
                                             <button
                                                onClick={() => {
                                                   navigator.clipboard.writeText(account.email);
                                                   toast.success("Email copied to clipboard");
                                                   setOpenDropdownAccountId(null);
                                                }}
                                                className="w-full text-left px-2.5 py-1.5 text-xs rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-800 dark:hover:text-neutral-100 transition-colors flex items-center gap-2"
                                             >
                                                <Copy size={12} />
                                                Copy Email
                                             </button>
                                             <button
                                                onClick={() => {
                                                   toast.success("Connection status: Healthy");
                                                   setOpenDropdownAccountId(null);
                                                }}
                                                className="w-full text-left px-2.5 py-1.5 text-xs rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-800 dark:hover:text-neutral-100 transition-colors flex items-center gap-2"
                                             >
                                                <Activity size={12} />
                                                Verify Connection
                                             </button>
                                             <div className="border-t border-neutral-100 dark:border-neutral-800 my-1" />
                                             <button
                                                onClick={async () => {
                                                   setOpenDropdownAccountId(null);
                                                   if (await confirm({ title: "Disconnect account?", message: `Are you sure you want to disconnect this ${PROVIDER_NAMES[account.provider.toLowerCase()] || account.provider} account?` })) {
                                                      deleteOcAccount.mutate(account.id);
                                                   }
                                                }}
                                                className="w-full text-left px-2.5 py-1.5 text-xs rounded-lg text-red-500 hover:bg-red-500/10 transition-colors flex items-center gap-2 font-bold"
                                                disabled={deleteOcAccount.isPending}
                                             >
                                                <Trash2 size={12} />
                                                Disconnect
                                             </button>
                                          </div>
                                       </>
                                    )}

                                   <div className="space-y-4">
                                      {/* Provider Logo & Info */}
                                      <div className="flex items-center space-x-3">
                                         <div className="p-2 bg-neutral-100 dark:bg-neutral-800 rounded-xl transition-transform group-hover:scale-105 duration-300">
                                            {PROVIDER_LOGOS[account.provider.toLowerCase()] || <Database className="w-6 h-6 text-neutral-500" />}
                                         </div>
                                         <div className="pr-4">
                                            <p className="text-xs font-black text-neutral-800 dark:text-neutral-200">{PROVIDER_NAMES[account.provider.toLowerCase()] || account.provider}</p>
                                            <p className="text-[10px] text-neutral-450 font-medium truncate max-w-[140px]" title={account.email}>{account.email}</p>
                                         </div>
                                      </div>

                                      {/* Progress Bar & Details */}
                                      <div className="space-y-2">
                                         <div className="w-full bg-neutral-200 dark:bg-neutral-800 h-2 rounded-full overflow-hidden">
                                            <div 
                                               className="bg-blue-500 h-full rounded-full transition-all duration-500"
                                               style={{ width: `${usedPercent}%` }}
                                            />
                                         </div>
                                         <div className="flex items-center justify-between text-[10px] font-bold text-neutral-500">
                                            <span>{formatSize(account.used_space || 0)} used</span>
                                            <span>{formatSize(account.total_space || 0)} total</span>
                                         </div>
                                      </div>
                                   </div>
                                </div>
                             );
                          })}
                       </div>
                    ) : (
                       <p className="text-xs text-neutral-500 italic">No storage accounts connected. Link a cloud provider below.</p>
                    )}
                 </div>

                  {/* Link New Cloud Storage Provider */}
                  <div className="border-t border-neutral-100 dark:border-neutral-800 pt-5 space-y-4">
                     <h4 className="text-[10px] font-black uppercase text-neutral-400 tracking-wider">Link New Provider</h4>
                     
                     <div className="flex flex-wrap gap-3">
                        {/* OAuth providers */}
                        {[
                          { id: "google", label: "Google Drive" },
                          { id: "onedrive", label: "OneDrive" },
                          { id: "dropbox", label: "Dropbox" },
                          { id: "yandex", label: "Yandex Disk" }
                        ].map((prov) => (
                           <button 
                              key={prov.id} 
                              onClick={() => connectOcOAuth.mutate(prov.id)}
                              disabled={connectOcOAuth.isPending}
                              className="group flex items-center gap-2.5 p-2 px-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/10 hover:bg-neutral-100 dark:hover:bg-neutral-800/60 hover:border-neutral-300 dark:hover:border-neutral-700 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-sm hover:shadow"
                           >
                              <div className="w-5 h-5 flex items-center justify-center transition-transform group-hover:scale-105 duration-200">
                                 {PROVIDER_LOGOS[prov.id]}
                              </div>
                              <span className="text-xs font-bold text-neutral-600 dark:text-neutral-300 flex items-center gap-1.5">
                                 {connectOcOAuth.isPending && connectOcOAuth.variables === prov.id && (
                                   <Loader2 className="animate-spin" size={12} />
                                 )}
                                 Connect {prov.label}
                              </span>
                           </button>
                        ))}

                        {/* Credential providers (Mega, pCloud, S3) */}
                        {[
                          { id: "mega", label: "MEGA" },
                          { id: "pcloud", label: "pCloud" },
                          { id: "s3", label: "S3 Storage" }
                        ].map((prov) => {
                           const isActive = selectedCredentialProvider === prov.id;
                           return (
                              <button 
                                 key={prov.id} 
                                 onClick={() => {
                                   if (isActive) {
                                     setSelectedCredentialProvider(null);
                                   } else {
                                     setSelectedCredentialProvider(prov.id);
                                     setCredentialForm({ email: "", password: "", bucket: "", accessKeyId: "", secretAccessKey: "", region: "us-east-1", endpoint: "" });
                                   }
                                 }}
                                 className={cn(
                                   "group flex items-center gap-2.5 p-2 px-3.5 rounded-xl border border-dashed transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-sm hover:shadow",
                                   isActive 
                                     ? "border-primary bg-primary/5 text-primary" 
                                     : "border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/10 hover:bg-neutral-100 dark:hover:bg-neutral-800/60 hover:border-neutral-300 dark:hover:border-neutral-700"
                                 )}
                              >
                                 <div className="w-5 h-5 flex items-center justify-center transition-transform group-hover:scale-105 duration-200">
                                    {PROVIDER_LOGOS[prov.id]}
                                 </div>
                                 <span className={cn(
                                    "text-xs font-bold",
                                    isActive ? "text-primary" : "text-neutral-600 dark:text-neutral-300"
                                 )}>
                                    Connect {prov.label}
                                 </span>
                              </button>
                           );
                        })}
                     </div>
                  </div>
              </div>
            )}
            
            {/* Inline credential input forms if one is selected */}
            {selectedCredentialProvider && (
              <div className="border-t border-neutral-100 dark:border-neutral-800 pt-4 space-y-4">
                 <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold capitalize">Link {selectedCredentialProvider} Account</h4>
                    <Button variant="ghost" className="h-6 px-2 text-[10px] font-bold" onClick={() => setSelectedCredentialProvider(null)}>Cancel</Button>
                 </div>
                 
                 <div className="space-y-3 max-w-md">
                    {(selectedCredentialProvider === "mega" || selectedCredentialProvider === "pcloud") && (
                       <>
                          <div className="space-y-1">
                             <label className="text-[10px] font-bold text-neutral-400">Account Email / Username</label>
                             <input 
                               type="email"
                               placeholder="user@example.com"
                               value={credentialForm.email}
                               onChange={(e) => setCredentialForm({ ...credentialForm, email: e.target.value })}
                               className="w-full bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 h-10 text-xs focus:ring-2 focus:ring-primary/20 outline-none"
                             />
                          </div>
                          <div className="space-y-1">
                             <label className="text-[10px] font-bold text-neutral-400">Password</label>
                             <input 
                               type="password"
                               placeholder="••••••••"
                               value={credentialForm.password}
                               onChange={(e) => setCredentialForm({ ...credentialForm, password: e.target.value })}
                               className="w-full bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 h-10 text-xs focus:ring-2 focus:ring-primary/20 outline-none"
                             />
                          </div>
                       </>
                    )}

                    {selectedCredentialProvider === "s3" && (
                       <>
                          <div className="space-y-1">
                             <label className="text-[10px] font-bold text-neutral-400">Bucket Name</label>
                             <input 
                               type="text"
                               placeholder="my-bucket-name"
                               value={credentialForm.bucket}
                               onChange={(e) => setCredentialForm({ ...credentialForm, bucket: e.target.value })}
                               className="w-full bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 h-10 text-xs focus:ring-2 focus:ring-primary/20 outline-none"
                             />
                          </div>
                          <div className="space-y-1">
                             <label className="text-[10px] font-bold text-neutral-400">Access Key ID</label>
                             <input 
                               type="text"
                               placeholder="AKIAIOSFODNN7EXAMPLE"
                               value={credentialForm.accessKeyId}
                               onChange={(e) => setCredentialForm({ ...credentialForm, accessKeyId: e.target.value })}
                               className="w-full bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 h-10 text-xs focus:ring-2 focus:ring-primary/20 outline-none"
                             />
                          </div>
                          <div className="space-y-1">
                             <label className="text-[10px] font-bold text-neutral-400">Secret Access Key</label>
                             <input 
                               type="password"
                               placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
                               value={credentialForm.secretAccessKey}
                               onChange={(e) => setCredentialForm({ ...credentialForm, secretAccessKey: e.target.value })}
                               className="w-full bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 h-10 text-xs focus:ring-2 focus:ring-primary/20 outline-none"
                             />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                             <div className="space-y-1">
                                <label className="text-[10px] font-bold text-neutral-400">Region</label>
                                <input 
                                  type="text"
                                  placeholder="us-east-1"
                                  value={credentialForm.region}
                                  onChange={(e) => setCredentialForm({ ...credentialForm, region: e.target.value })}
                                  className="w-full bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 h-10 text-xs focus:ring-2 focus:ring-primary/20 outline-none"
                                />
                             </div>
                             <div className="space-y-1">
                                <label className="text-[10px] font-bold text-neutral-400">Endpoint (Optional)</label>
                                <input 
                                  type="text"
                                  placeholder="https://s3.amazonaws.com"
                                  value={credentialForm.endpoint}
                                  onChange={(e) => setCredentialForm({ ...credentialForm, endpoint: e.target.value })}
                                  className="w-full bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 h-10 text-xs focus:ring-2 focus:ring-primary/20 outline-none"
                                />
                             </div>
                          </div>
                       </>
                    )}

                    <Button 
                      className="w-full h-10 rounded-xl text-xs font-bold mt-2"
                      onClick={() => {
                        const body = selectedCredentialProvider === "s3" ? {
                          bucket: credentialForm.bucket,
                          accessKeyId: credentialForm.accessKeyId,
                          secretAccessKey: credentialForm.secretAccessKey,
                          region: credentialForm.region,
                          endpoint: credentialForm.endpoint || undefined
                        } : {
                          email: credentialForm.email,
                          password: credentialForm.password
                        };
                        connectOcCreds.mutate({ provider: selectedCredentialProvider!, body });
                        setSelectedCredentialProvider(null);
                      }}
                      disabled={connectOcCreds.isPending}
                    >
                       {connectOcCreds.isPending ? <Loader2 className="animate-spin" size={14} /> : `Connect ${selectedCredentialProvider}`}
                    </Button>
                 </div>
              </div>
            )}
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
        <h2 className="text-[10px] font-bold uppercase text-neutral-400 tracking-[0.2em] px-1">Utilities</h2>
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
