"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import { SystemStatus, StructuredResponse } from "@/types";
import { ShieldAlert, AlertTriangle, Info, ShieldCheck } from "lucide-react";
import { cn } from "@/components/ui";

export function IntegrityBanner() {
  const { data: status } = useQuery({
    queryKey: ["system-status"],
    queryFn: async () => {
      const resp = await api.get<StructuredResponse<SystemStatus>>("/system/status");
      return resp.data.data;
    },
    refetchInterval: 30000,
  });

  const integrity = status?.integrity;

  if (!integrity || !integrity.safe_mode) return null;

  return (
    <div className={cn(
      "w-full px-4 py-2 flex items-center justify-center space-x-3 text-[10px] md:text-xs font-black uppercase tracking-widest animate-in slide-in-from-top duration-500",
      integrity.message.includes("CI Environment") 
        ? "bg-blue-500 text-white" 
        : "bg-destructive text-white shadow-lg shadow-destructive/20"
    )}>
      {integrity.message.includes("CI Environment") ? (
        <Info size={14} className="shrink-0" />
      ) : (
        <ShieldAlert size={14} className="shrink-0 animate-pulse" />
      )}
      
      <span className="truncate">{integrity.message}</span>
      
      {(integrity.state === "LOCKED" || integrity.state === "SAFE_MODE") && !integrity.message.includes("CI") ? (
        <div className="hidden sm:flex items-center space-x-2 border-l border-white/20 pl-3 ml-1">
           <code className="bg-black/20 px-2 py-0.5 rounded text-[9px]">tdrive verify-instance</code>
        </div>
      ) : null}
    </div>
  );
}
