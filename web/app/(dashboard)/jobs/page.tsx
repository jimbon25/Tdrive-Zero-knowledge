"use client";

import React from "react";
import { useJobs } from "@/hooks/api/useJobs";
import { Progress } from "@/components/ui";
import { 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  ArrowUpCircle, 
  ArrowDownCircle,
  FileIcon,
  Search
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { formatLocalTime } from "@/lib/utils";
import { cn } from "@/components/ui";
import { useUIStore } from "@/store/useUIStore";

export default function JobsPage() {
  const { data: jobs, isLoading } = useJobs();
  const { density } = useUIStore();
  const isCompact = density === "compact";

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "text-green-500 bg-green-500/10";
      case "failed": return "text-destructive bg-destructive/10";
      case "running": return "text-primary bg-primary/10";
      default: return "text-neutral-500 bg-neutral-500/10";
    }
  };

  return (
    <div className={cn(
      "max-w-4xl mx-auto animate-in fade-in duration-500",
      isCompact ? "space-y-4" : "space-y-6"
    )}>
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center space-x-3">
          <div className="p-1.5 bg-primary/10 text-primary rounded-lg">
            <Clock size={18} />
          </div>
          <h1 className="text-xl font-black tracking-tight">Recent Tasks</h1>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-24 text-neutral-400">
          <Loader2 className="animate-spin mb-4" size={32} strokeWidth={1.5} />
          <p className="text-xs font-bold uppercase tracking-widest opacity-50">Fetching history...</p>
        </div>
      ) : !jobs || jobs.length === 0 ? (
        <div className="text-center py-24 bg-neutral-50/50 dark:bg-neutral-900/20 border border-dashed border-neutral-200 dark:border-neutral-800 rounded-3xl text-neutral-400">
          <Search size={48} strokeWidth={1} className="mx-auto mb-4 opacity-20" />
          <p className="text-sm font-bold uppercase tracking-tighter">No tasks recorded</p>
        </div>
      ) : (
        <div className={cn("grid grid-cols-1", isCompact ? "gap-2" : "gap-3")}>
          {jobs.map((job) => (
            <div 
              key={job.job_id} 
              className={cn(
                "bg-card border border-neutral-200 dark:border-neutral-800 transition-all group hover:border-primary/30",
                isCompact ? "p-3 rounded-xl" : "p-4 rounded-2xl"
              )}
            >
              <div className={cn("flex items-center justify-between", isCompact ? "mb-2" : "mb-3")}>
                <div className="flex items-center space-x-3 min-w-0">
                  <div className={cn(
                    "rounded-full shrink-0 flex items-center justify-center",
                    isCompact ? "w-8 h-8" : "w-10 h-10",
                    getStatusColor(job.status)
                  )}>
                    {job.status === "running" ? <Loader2 size={16} className="animate-spin" /> : 
                     job.type === "upload" ? <ArrowUpCircle size={16} /> : <ArrowDownCircle size={16} />}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-sm truncate capitalize">{job.type} Task</span>
                      <span className="text-[9px] px-1.5 py-0.5 bg-neutral-100 dark:bg-neutral-800 text-neutral-500 rounded-md font-mono hidden sm:inline">
                        #{job.job_id.slice(0, 8)}
                      </span>
                    </div>
                    <div className="flex items-center mt-0.5 space-x-2 text-[10px] text-neutral-400 font-medium">
                      <span>{formatLocalTime(job.created_at)}</span>
                    </div>
                  </div>
                </div>
                
                <div className={cn(
                  "px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider border shrink-0",
                  job.status === "completed" ? "border-green-500/20 text-green-600 bg-green-500/5" :
                  job.status === "failed" ? "border-destructive/20 text-destructive bg-destructive/5" :
                  "border-primary/20 text-primary bg-primary/5"
                )}>
                  {job.status}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-[10px] font-bold text-neutral-500 uppercase tracking-tighter">
                   <span>Progress</span>
                   <span>{job.progress.toFixed(1)}%</span>
                </div>
                <Progress value={job.progress} className="h-1" />
                {job.error && (
                   <p className="text-[10px] text-destructive bg-destructive/5 p-2 rounded-lg font-medium mt-2 border border-destructive/10 italic">
                      Error: {job.error}
                   </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
