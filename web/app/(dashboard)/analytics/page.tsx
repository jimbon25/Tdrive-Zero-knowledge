"use client";

import React from "react";
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip 
} from "recharts";
import { 
  Database, 
  Files, 
  Trash2, 
  HardDrive,
  BarChart3,
  TrendingUp,
  Folder,
  File as FileIcon,
  ChevronRight,
  ArrowUpRight,
  Download,
  ExternalLink,
  Clock,
  Sparkles
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import { 
  StructuredResponse, 
  StorageOverview, 
  FileTypeStats, 
  FileItem, 
  FolderAnalytics, 
  GrowthMetrics 
} from "@/types";
import { cn } from "@/components/ui";
import { formatLocalTime } from "@/lib/utils";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6", "#64748b"];

export default function AnalyticsPage() {
  const { data: overview } = useQuery({
    queryKey: ["analytics-overview"],
    queryFn: async () => {
      const resp = await api.get<StructuredResponse<StorageOverview>>("/analytics/overview");
      return resp.data.data;
    }
  });

  const { data: fileTypes } = useQuery({
    queryKey: ["analytics-file-types"],
    queryFn: async () => {
      const resp = await api.get<StructuredResponse<FileTypeStats[]>>("/analytics/file-types");
      return resp.data.data;
    }
  });

  const { data: largestFiles } = useQuery({
    queryKey: ["analytics-largest-files"],
    queryFn: async () => {
      const resp = await api.get<StructuredResponse<FileItem[]>>("/analytics/largest-files");
      return resp.data.data;
    }
  });

  const { data: largestFolders } = useQuery({
    queryKey: ["analytics-largest-folders"],
    queryFn: async () => {
      const resp = await api.get<StructuredResponse<FolderAnalytics[]>>("/analytics/largest-folders");
      return resp.data.data;
    }
  });

  const { data: growth } = useQuery({
    queryKey: ["analytics-growth"],
    queryFn: async () => {
      const resp = await api.get<StructuredResponse<GrowthMetrics>>("/analytics/growth");
      return resp.data.data;
    }
  });

  const { data: recentlyUploaded } = useQuery({
    queryKey: ["analytics-recent"],
    queryFn: async () => {
      const resp = await api.get<StructuredResponse<FileItem[]>>("/analytics/recent");
      return resp.data.data;
    }
  });

  const formatSize = (bytes: number) => {
    if (!bytes) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const chartData = fileTypes?.map(t => ({
    name: t.category,
    value: t.size
  })) || [];

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-[#fafafa] dark:bg-neutral-950 scrollbar-none pb-20 md:pb-8">
      {/* 1. Slim Header */}
      <header className="px-6 pt-8 pb-6 md:px-10 md:pt-10 md:pb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
           <div className="flex items-center space-x-2 mb-1">
              <div className="w-8 h-1 bg-primary rounded-full" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Intelligence</span>
           </div>
           <h1 className="text-3xl md:text-4xl font-black tracking-tight text-neutral-900 dark:text-neutral-50">
             Storage <span className="text-neutral-400 dark:text-neutral-600">Analytics</span>
           </h1>
        </div>
        <div className="flex items-center space-x-3 text-[11px] font-bold text-neutral-500 uppercase tracking-widest bg-white dark:bg-neutral-900 px-4 py-2 rounded-full border border-neutral-100 dark:border-neutral-800 shadow-sm">
           <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
           <span>System Synced</span>
        </div>
      </header>

      <div className="px-6 md:px-10 space-y-6 md:space-y-8">
        
        {/* 2. Compact Statistics Row */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
           <CompactStatItem 
              label="Total Files" 
              value={overview?.total_files.toLocaleString() || "0"} 
              icon={Files} 
              theme="blue"
           />
           <CompactStatItem 
              label="Active Space" 
              value={formatSize(overview?.total_size || 0)} 
              icon={HardDrive} 
              theme="emerald"
           />
           <CompactStatItem 
              label="Trash Bin" 
              value={formatSize(overview?.trash_size || 0)} 
              icon={Trash2} 
              theme="rose"
           />
           <CompactStatItem 
              label="Cloud Limit" 
              value="Unlimited" 
              icon={Database} 
              theme="amber"
           />
        </section>

        {/* 3. Unified Intelligence Section (Chart + Growth + Tips) */}
        <section className="bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 rounded-[32px] overflow-hidden shadow-sm">
           <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-neutral-50 dark:divide-neutral-800">
              
              {/* Left: File Distribution */}
              <div className="lg:col-span-7 p-6 md:p-10">
                 <div className="flex items-center justify-between mb-8">
                    <h2 className="text-sm font-black uppercase tracking-[0.15em] text-neutral-400">File Distribution</h2>
                    <BarChart3 size={16} className="text-neutral-300" />
                 </div>
                 
                 <div className="flex flex-col md:flex-row items-center gap-8 md:gap-12">
                    <div className="w-full md:w-1/2 aspect-square max-w-[240px]">
                       <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={chartData}
                              innerRadius={65}
                              outerRadius={90}
                              paddingAngle={8}
                              dataKey="value"
                              stroke="none"
                            >
                              {chartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} className="outline-none" />
                              ))}
                            </Pie>
                            <Tooltip 
                               formatter={(value: any) => formatSize(Number(value || 0))}
                               contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '12px', fontWeight: 'bold' }}
                            />
                          </PieChart>
                       </ResponsiveContainer>
                    </div>

                    <div className="w-full md:w-1/2 space-y-4">
                       {fileTypes?.map((stat, i) => (
                          <div key={stat.category} className="flex items-center justify-between group">
                             <div className="flex items-center space-x-3">
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                                <span className="text-xs font-bold text-neutral-600 dark:text-neutral-400">{stat.category}</span>
                             </div>
                             <div className="flex items-center space-x-3">
                                <span className="text-[10px] font-black text-neutral-300 tabular-nums">{stat.percentage.toFixed(0)}%</span>
                                <span className="text-xs font-black text-neutral-900 dark:text-neutral-100 tabular-nums">{formatSize(stat.size)}</span>
                             </div>
                          </div>
                       ))}
                    </div>
                 </div>
              </div>

              {/* Right: Growth & Insight */}
              <div className="lg:col-span-5 bg-neutral-50/50 dark:bg-neutral-900/30 p-6 md:p-10 flex flex-col justify-between space-y-10">
                 <div>
                    <h2 className="text-sm font-black uppercase tracking-[0.15em] text-neutral-400 mb-8">Storage Growth</h2>
                    <div className="space-y-6">
                       <GrowthRow label="Daily" value={growth?.today || 0} formatSize={formatSize} percentage={15} />
                       <GrowthRow label="Weekly" value={growth?.last_7_days || 0} formatSize={formatSize} percentage={45} />
                       <GrowthRow label="Monthly" value={growth?.last_30_days || 0} formatSize={formatSize} percentage={80} theme="primary" />
                    </div>
                 </div>

                 <div className="p-5 bg-white dark:bg-neutral-800 rounded-2xl border border-neutral-100 dark:border-neutral-700 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-3 text-primary/10 group-hover:text-primary/20 transition-colors">
                       <Sparkles size={40} />
                    </div>
                    <div className="flex items-center space-x-2 mb-2 text-primary">
                       <TrendingUp size={14} strokeWidth={3} />
                       <span className="text-[10px] font-black uppercase tracking-widest">Efficiency Tip</span>
                    </div>
                    <p className="text-xs font-bold leading-relaxed text-neutral-600 dark:text-neutral-300 pr-8">
                       {overview && overview.trash_size > 1024**3 
                         ? "Your trash is holding over 1GB. Emptying it will keep your database index lean and fast."
                         : "Your storage is optimized! Regularly review your files and consider archiving old data to maintain peak performance."}
                    </p>
                 </div>
              </div>
           </div>
        </section>

        {/* 4. Tighter Recently Uploaded */}
        <section>
           <div className="flex items-center justify-between mb-4 px-2">
              <div className="flex items-center space-x-2">
                 <Clock size={16} className="text-neutral-400" />
                 <h2 className="text-xs font-black uppercase tracking-[0.2em] text-neutral-500 italic">Recently Uploaded</h2>
              </div>
              <button className="text-[10px] font-black text-primary uppercase tracking-widest hover:underline transition-all">View All</button>
           </div>
           
           <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3 md:gap-4">
              {recentlyUploaded?.slice(0, 16).map(file => (
                 <div key={file.file_id} className="group relative aspect-square bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 rounded-2xl overflow-hidden shadow-sm hover:border-primary/40 transition-all cursor-pointer">
                    {file.thumbnail ? (
                       <img 
                          src={`data:image/jpeg;base64,${file.thumbnail}`} 
                          alt={file.filename}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                       />
                    ) : (
                       <div className="w-full h-full flex items-center justify-center bg-neutral-50 dark:bg-neutral-800">
                          <FileIcon size={20} className="text-neutral-300 group-hover:text-primary/40 transition-colors" />
                       </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2.5">
                       <p className="text-[9px] font-black text-white truncate">{file.filename}</p>
                       <p className="text-[8px] font-bold text-neutral-300">{formatSize(file.size)}</p>
                       <p className="text-[8px] text-neutral-400 mt-0.5">{formatLocalTime(file.created_at)}</p>
                    </div>
                 </div>
              ))}
              {!recentlyUploaded?.length && (
                 <div className="col-span-full py-10 bg-white dark:bg-neutral-900 border border-dashed border-neutral-200 dark:border-neutral-800 rounded-[32px] text-center">
                    <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">No Recent Activity</p>
                 </div>
              )}
           </div>
        </section>

        {/* 5. Compact Dual Reports */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-12">
          
          {/* Largest Files Table */}
          <div className="bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 rounded-[32px] shadow-sm flex flex-col h-[400px]">
             <div className="p-6 border-b border-neutral-50 dark:border-neutral-800 flex items-center justify-between">
                <h2 className="text-xs font-black uppercase tracking-[0.2em] text-neutral-400 italic px-2">Top Largest Files</h2>
                <div className="p-2 bg-neutral-50 dark:bg-neutral-800 rounded-xl">
                   <HardDrive size={14} className="text-neutral-400" />
                </div>
             </div>
             <div className="flex-1 overflow-y-auto scrollbar-none px-2">
                {largestFiles?.length ? (
                  largestFiles.map((file) => (
                    <div key={file.file_id} className="flex items-center justify-between p-3.5 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 rounded-2xl transition-all group mx-1">
                       <div className="flex items-center space-x-4 min-w-0">
                          {file.thumbnail ? (
                             <img 
                                src={`data:image/jpeg;base64,${file.thumbnail}`} 
                                className="w-9 h-9 rounded-lg object-cover shrink-0 border border-neutral-100 dark:border-neutral-800"
                             />
                          ) : (
                             <div className="w-9 h-9 bg-blue-50 dark:bg-blue-900/10 rounded-lg flex items-center justify-center shrink-0">
                                <FileIcon size={16} className="text-blue-500" />
                             </div>
                          )}
                          <div className="min-w-0">
                             <h4 className="text-[13px] font-black truncate text-neutral-800 dark:text-neutral-200">{file.filename}</h4>
                             <p className="text-[9px] font-bold text-neutral-400 uppercase tracking-tight">{file.virtual_path}</p>
                          </div>
                       </div>
                       <div className="flex items-center space-x-3">
                          <span className="text-[11px] font-black text-neutral-900 dark:text-neutral-100 tabular-nums">
                             {formatSize(file.size)}
                          </span>
                          <div className="flex items-center space-x-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                             <ActionButton icon={Download} />
                             <ActionButton icon={Trash2} theme="rose" />
                          </div>
                       </div>
                    </div>
                  ))
                ) : (
                  <EmptyState />
                )}
             </div>
          </div>

          {/* Largest Folders Table */}
          <div className="bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 rounded-[32px] shadow-sm flex flex-col h-[400px]">
             <div className="p-6 border-b border-neutral-50 dark:border-neutral-800 flex items-center justify-between">
                <h2 className="text-xs font-black uppercase tracking-[0.2em] text-neutral-400 italic px-2">Space By Folder</h2>
                <div className="p-2 bg-neutral-50 dark:bg-neutral-800 rounded-xl">
                   <Folder size={14} className="text-neutral-400" />
                </div>
             </div>
             <div className="flex-1 overflow-y-auto scrollbar-none px-2">
                {largestFolders?.length ? (
                   largestFolders.map((folder) => (
                     <div key={folder.path} className="flex items-center justify-between p-3.5 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 rounded-2xl transition-all group mx-1 cursor-pointer">
                        <div className="flex items-center space-x-4 min-w-0">
                           <div className="w-9 h-9 bg-amber-50 dark:bg-amber-900/10 rounded-lg flex items-center justify-center shrink-0">
                              <Folder size={16} className="text-amber-500" />
                           </div>
                           <div className="min-w-0">
                              <h4 className="text-[13px] font-black truncate text-neutral-800 dark:text-neutral-200">{folder.path === "/" ? "Root Storage" : folder.path}</h4>
                              <p className="text-[9px] font-bold text-neutral-400 uppercase tracking-tight">{folder.total_files} items</p>
                           </div>
                        </div>
                        <div className="flex items-center space-x-4">
                           <span className="text-[11px] font-black text-neutral-900 dark:text-neutral-100 tabular-nums">{formatSize(folder.total_size)}</span>
                           <ChevronRight size={14} className="text-neutral-300 group-hover:text-primary transition-colors" />
                        </div>
                     </div>
                   ))
                ) : (
                  <EmptyState />
                )}
             </div>
          </div>
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
      amber: "text-amber-500 bg-amber-50 dark:bg-amber-900/10"
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

function GrowthRow({ label, value, formatSize, percentage, theme = "neutral" }: any) {
   return (
      <div className="space-y-1.5">
         <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
            <span className="text-neutral-400">{label}</span>
            <span className={cn(theme === "primary" ? "text-primary" : "text-neutral-600 dark:text-neutral-400")}>
               +{formatSize(value)}
            </span>
         </div>
         <div className="h-1.5 w-full bg-neutral-200/50 dark:bg-neutral-800 rounded-full overflow-hidden">
            <div 
               className={cn("h-full transition-all duration-1000 ease-out rounded-full", theme === "primary" ? "bg-primary" : "bg-neutral-400 dark:bg-neutral-600")} 
               style={{ width: `${percentage}%` }}
            />
         </div>
      </div>
   );
}

function ActionButton({ icon: Icon, theme = "primary" }: any) {
   const themes: any = {
      primary: "hover:bg-primary/10 text-neutral-400 hover:text-primary",
      rose: "hover:bg-rose-500/10 text-neutral-400 hover:text-rose-500"
   };

   return (
      <button className={cn("p-1.5 rounded-lg transition-colors", themes[theme])}>
         <Icon size={14} />
      </button>
   );
}

function EmptyState() {
   return (
      <div className="flex flex-col items-center justify-center p-12 text-center space-y-3 opacity-30">
         <HardDrive size={32} className="text-neutral-400" strokeWidth={1} />
         <p className="text-[10px] font-black text-neutral-500 uppercase tracking-widest italic">No Records Found</p>
      </div>
   );
}
