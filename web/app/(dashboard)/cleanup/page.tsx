"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import { StructuredResponse } from "@/types";
import { useNotificationStore } from "@/store/useNotificationStore";
import { 
  Trash2, 
  Loader2, 
  Sparkles, 
  Star, 
  Copy,
  Layers, 
  AlertTriangle, 
  CheckCircle2, 
  Calendar,
  FolderOpen,
  Info,
  ExternalLink,
  ChevronDown
} from "lucide-react";
import { Button } from "@/components/ui";
import toast from "react-hot-toast";
import Link from "next/link";
import { formatLocalTime } from "@/lib/utils";

interface DuplicateFile {
  file_id: string;
  filename: string;
  virtual_path: string;
  size: number;
  sha256: string;
  is_starred: boolean;
  is_trashed: boolean;
  created_at: string;
}

interface DuplicateGroup {
  sha256: string;
  size: number;
  files: DuplicateFile[];
}

interface DuplicateSummary {
  duplicate_groups_count: number;
  duplicate_files_count: number;
  total_files_in_groups: number;
  recoverable_size: number;
}

export default function CleanupPage() {
  const queryClient = useQueryClient();
  const { confirm, addNotification } = useNotificationStore();
  const [selectedFiles, setSelectedFiles] = useState<Record<string, boolean>>({});
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  // Fetch summary stats
  const { data: summary, isLoading: isSummaryLoading, refetch: refetchSummary } = useQuery({
    queryKey: ["duplicates-summary"],
    queryFn: async () => {
      const response = await api.get<StructuredResponse<DuplicateSummary>>("/duplicates/summary");
      return response.data.data;
    },
  });

  // Fetch duplicate groups
  const { data: groups, isLoading: isGroupsLoading, refetch: refetchGroups } = useQuery({
    queryKey: ["duplicates-groups"],
    queryFn: async () => {
      const response = await api.get<StructuredResponse<DuplicateGroup[]>>("/duplicates/groups");
      return response.data.data || [];
    },
  });

  // Cleanup mutation
  const cleanupMutation = useMutation({
    mutationFn: async (payload: { action: string; file_ids?: string[] }) => {
      const response = await api.post<StructuredResponse<number>>("/duplicates/cleanup", payload);
      return response.data.data;
    },
    onSuccess: (data) => {
      toast.success(`Cleanup complete: ${data} duplicate files moved to trash`);
      addNotification({
        type: "success",
        title: "Duplicates Cleaned Up",
        message: `Successfully moved ${data} duplicate files to the Trash Bin.`
      });
      setSelectedFiles({});
      queryClient.invalidateQueries({ queryKey: ["duplicates-summary"] });
      queryClient.invalidateQueries({ queryKey: ["duplicates-groups"] });
      queryClient.invalidateQueries({ queryKey: ["system-status"] });
    },
    onError: (err: any) => {
      const errMsg = err?.response?.data?.detail || "Failed to perform cleanup";
      toast.error(errMsg);
    },
  });

  const handleGlobalCleanup = async (action: 'keep_newest' | 'keep_oldest' | 'keep_starred') => {
    let actionLabel = "";
    let description = "";

    if (action === "keep_newest") {
      actionLabel = "Keep Newest Copies";
      description = "This will move all older copies in every duplicate group to the Trash Bin, keeping only the newest copy.";
    } else if (action === "keep_oldest") {
      actionLabel = "Keep Oldest Copies";
      description = "This will move all newer copies in every duplicate group to the Trash Bin, keeping only the oldest copy.";
    } else if (action === "keep_starred") {
      actionLabel = "Keep Starred Copies";
      description = "This will move all non-starred copies in every duplicate group to the Trash Bin (if a starred copy exists). If no copy is starred, it keeps the newest copy.";
    }

    const isConfirmed = await confirm({
      title: `${actionLabel}?`,
      message: `${description} No files will be permanently deleted; they are moved to the Trash Bin.`,
      confirmLabel: "Apply Cleanup Rule"
    });

    if (isConfirmed) {
      cleanupMutation.mutate({ action });
    }
  };

  const handleManualCleanup = async () => {
    const fileIdsToTrash = Object.keys(selectedFiles).filter(fid => selectedFiles[fid]);
    if (fileIdsToTrash.length === 0) return;

    const isConfirmed = await confirm({
      title: "Delete Selected Duplicates?",
      message: `You are about to move ${fileIdsToTrash.length} selected duplicate files to the Trash Bin.`,
      confirmLabel: "Move to Trash"
    });

    if (isConfirmed) {
      cleanupMutation.mutate({ action: "manual", file_ids: fileIdsToTrash });
    }
  };

  const selectGroupCopies = (group: DuplicateGroup, rule: 'newest' | 'oldest' | 'starred') => {
    const files = [...group.files];
    if (files.length <= 1) return;

    let filesToTrash: DuplicateFile[] = [];

    if (rule === 'newest') {
      // Sort descending (newest first). Keep first, trash others.
      const sorted = [...files].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      filesToTrash = sorted.slice(1);
    } else if (rule === 'oldest') {
      // Sort ascending (oldest first). Keep first, trash others.
      const sorted = [...files].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      filesToTrash = sorted.slice(1);
    } else if (rule === 'starred') {
      const starred = files.filter(f => f.is_starred);
      if (starred.length > 0) {
        filesToTrash = files.filter(f => !f.is_starred);
      } else {
        // Fallback to newest
        const sorted = [...files].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        filesToTrash = sorted.slice(1);
      }
    }

    const nextSelected = { ...selectedFiles };
    // Clear selection for this group first
    group.files.forEach(f => {
      nextSelected[f.file_id] = false;
    });
    // Mark target files for deletion
    filesToTrash.forEach(f => {
      nextSelected[f.file_id] = true;
    });
    setSelectedFiles(nextSelected);
  };

  const clearGroupSelection = (group: DuplicateGroup) => {
    const nextSelected = { ...selectedFiles };
    group.files.forEach(f => {
      delete nextSelected[f.file_id];
    });
    setSelectedFiles(nextSelected);
  };

  const toggleFileSelection = (fileId: string) => {
    setSelectedFiles(prev => ({
      ...prev,
      [fileId]: !prev[fileId]
    }));
  };

  const toggleGroupExpanded = (sha256: string) => {
    setExpandedGroups(prev => ({
      ...prev,
      [sha256]: !prev[sha256]
    }));
  };

  const formatSize = (bytes: number) => {
    if (!bytes) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };



  // Determine badges inside group
  const getFileBadges = (file: DuplicateFile, allFiles: DuplicateFile[]) => {
    const sortedByTime = [...allFiles].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    const oldest = sortedByTime[0];
    const newest = sortedByTime[sortedByTime.length - 1];

    const badges = [];
    if (file.file_id === newest.file_id) {
      badges.push(<span key="newest" className="px-2 py-0.5 text-[10px] font-bold bg-blue-500/10 text-blue-500 dark:bg-blue-400/15 dark:text-blue-400 rounded-md">Newest</span>);
    }
    if (file.file_id === oldest.file_id && oldest.file_id !== newest.file_id) {
      badges.push(<span key="oldest" className="px-2 py-0.5 text-[10px] font-bold bg-purple-500/10 text-purple-500 dark:bg-purple-400/15 dark:text-purple-400 rounded-md">Oldest</span>);
    }
    if (file.is_starred) {
      badges.push(
        <span key="starred" className="flex items-center space-x-0.5 px-2 py-0.5 text-[10px] font-bold bg-amber-500/10 text-amber-500 dark:bg-amber-400/15 dark:text-amber-400 rounded-md">
          <Star size={10} className="fill-amber-500 stroke-amber-500 shrink-0" />
          <span>Starred</span>
        </span>
      );
    }
    return badges;
  };

  const totalSelectedCount = Object.keys(selectedFiles).filter(fid => selectedFiles[fid]).length;

  const isLoading = isSummaryLoading || isGroupsLoading;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-6xl mx-auto pb-32">
      {/* 1. Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card border border-neutral-200 dark:border-neutral-800 p-6 md:p-8 rounded-[2rem] shadow-sm relative overflow-hidden">
        <div className="flex items-center space-x-5 relative z-10">
          <div className="p-4 bg-primary/10 text-primary rounded-2xl">
            <Sparkles size={28} />
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tight">Storage Cleanup</h1>
            <p className="text-xs text-neutral-400 font-bold uppercase tracking-widest mt-1">Optimize your personal cloud storage</p>
          </div>
        </div>
      </div>

      {/* 2. STATS SUMMARY */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-card border border-neutral-200 dark:border-neutral-800 p-5 rounded-2xl flex items-center space-x-4 shadow-sm hover:border-neutral-300 dark:hover:border-neutral-700 transition-all">
            <div className="p-3 bg-indigo-500/10 text-indigo-500 rounded-xl shrink-0">
              <Layers size={22} />
            </div>
            <div>
              <p className="text-2xl font-black">{summary.duplicate_groups_count}</p>
              <p className="text-xs text-neutral-400 font-bold uppercase tracking-wider">Duplicate Groups</p>
            </div>
          </div>
          
          <div className="bg-card border border-neutral-200 dark:border-neutral-800 p-5 rounded-2xl flex items-center space-x-4 shadow-sm hover:border-neutral-300 dark:hover:border-neutral-700 transition-all">
            <div className="p-3 bg-amber-500/10 text-amber-500 rounded-xl shrink-0">
              <Copy size={22} />
            </div>
            <div>
              <p className="text-2xl font-black">{summary.duplicate_files_count}</p>
              <p className="text-xs text-neutral-400 font-bold uppercase tracking-wider">Redundant Files</p>
            </div>
          </div>
          
          <div className="bg-card border border-neutral-200 dark:border-neutral-800 p-5 rounded-2xl flex items-center space-x-4 shadow-sm hover:border-neutral-300 dark:hover:border-neutral-700 transition-all">
            <div className="p-3 bg-rose-500/10 text-rose-500 rounded-xl shrink-0">
              <Trash2 size={22} />
            </div>
            <div>
              <p className="text-2xl font-black text-rose-500">{formatSize(summary.recoverable_size)}</p>
              <p className="text-xs text-neutral-400 font-bold uppercase tracking-wider">Recoverable Storage</p>
            </div>
          </div>
        </div>
      )}

      {/* 3. SMART CLEANUP ACTIONS */}
      {summary && summary.duplicate_groups_count > 0 && (
        <div className="bg-card border border-neutral-200 dark:border-neutral-800 p-6 rounded-3xl space-y-6 shadow-sm">
          <div className="flex items-center space-x-3">
            <Sparkles className="text-primary" size={20} />
            <h2 className="text-lg font-black tracking-tight">Smart Clean Rules</h2>
          </div>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 max-w-3xl">
            Automatically resolve all duplicate files by choosing one of the preservation strategies below. 
            One copy will always be preserved, and the duplicates will be moved to the Trash Bin.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <button
              onClick={() => handleGlobalCleanup("keep_newest")}
              disabled={cleanupMutation.isPending}
              className="flex flex-col items-center justify-center p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800 hover:border-blue-500/50 dark:hover:border-blue-500/40 hover:bg-blue-500/5 dark:hover:bg-blue-500/5 transition-all text-center space-y-2 group"
            >
              <span className="font-bold text-sm group-hover:text-blue-500 transition-colors">Keep Newest uploaded</span>
              <span className="text-xs text-neutral-400">Trashes older files in each group</span>
            </button>
            
            <button
              onClick={() => handleGlobalCleanup("keep_oldest")}
              disabled={cleanupMutation.isPending}
              className="flex flex-col items-center justify-center p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800 hover:border-purple-500/50 dark:hover:border-purple-500/40 hover:bg-purple-500/5 dark:hover:bg-purple-500/5 transition-all text-center space-y-2 group"
            >
              <span className="font-bold text-sm group-hover:text-purple-500 transition-colors">Keep Oldest uploaded</span>
              <span className="text-xs text-neutral-400">Trashes newer files in each group</span>
            </button>

            <button
              onClick={() => handleGlobalCleanup("keep_starred")}
              disabled={cleanupMutation.isPending}
              className="flex flex-col items-center justify-center p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800 hover:border-amber-500/50 dark:hover:border-amber-500/40 hover:bg-amber-500/5 dark:hover:bg-amber-500/5 transition-all text-center space-y-2 group"
            >
              <span className="font-bold text-sm group-hover:text-amber-500 transition-colors">Keep Starred copies</span>
              <span className="text-xs text-neutral-400">Keep favorites; fallback to newest copy</span>
            </button>
          </div>
        </div>
      )}

      {/* 4. DUPLICATE GROUPS SECTION */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-black tracking-tight">Duplicate Groups List</h2>
          {groups && groups.length > 0 && (
            <span className="text-xs text-neutral-400 font-bold uppercase tracking-wider">
              {groups.length} groups found
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-32 text-neutral-400 bg-card border border-neutral-200 dark:border-neutral-800 rounded-3xl">
            <Loader2 className="animate-spin mb-4" size={40} strokeWidth={1.5} />
            <p className="text-sm font-medium animate-pulse">Scanning database for duplicate files...</p>
          </div>
        ) : !groups || groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 bg-neutral-50/50 dark:bg-neutral-900/20 border-2 border-dashed border-neutral-200 dark:border-neutral-800 rounded-3xl text-neutral-400 text-center px-4">
            <CheckCircle2 size={64} strokeWidth={1} className="mb-4 text-emerald-500 opacity-80" />
            <p className="text-lg font-bold text-neutral-800 dark:text-neutral-200">No duplicate files found</p>
            <p className="text-sm mt-1 max-w-sm">Fantastic! Your TDrive storage is clean of duplicate hashes.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {groups.map((group) => {
              const isExpanded = expandedGroups[group.sha256] ?? true;
              const redundantCount = group.files.length - 1;
              const groupSelectedCount = group.files.filter(f => selectedFiles[f.file_id]).length;
              
              return (
                <div 
                  key={group.sha256}
                  className="bg-card border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-sm hover:shadow-md transition-shadow overflow-hidden"
                >
                  {/* Group Card Header */}
                  <div className="p-4 md:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/10">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                        <span className="font-extrabold text-sm md:text-base text-neutral-800 dark:text-neutral-200 break-all truncate max-w-md block">
                          {group.files[0]?.filename || "Unnamed File"}
                        </span>
                        <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider bg-neutral-200 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 rounded-md">
                          {formatSize(group.size)}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2 text-xs text-neutral-400 font-medium">
                        <span className="truncate max-w-[150px] md:max-w-[300px]">SHA256: {group.sha256}</span>
                        <span>•</span>
                        <span>{group.files.length} copies found ({redundantCount} unneeded)</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {/* Selectors */}
                      <span className="text-[10px] text-neutral-400 font-black uppercase tracking-wider mr-1 sm:block hidden">Select:</span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-[11px] font-bold rounded-lg"
                        onClick={() => selectGroupCopies(group, "newest")}
                      >
                        Keep Newest
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-[11px] font-bold rounded-lg"
                        onClick={() => selectGroupCopies(group, "oldest")}
                      >
                        Keep Oldest
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-[11px] font-bold rounded-lg"
                        onClick={() => selectGroupCopies(group, "starred")}
                      >
                        Keep Starred
                      </Button>
                      {groupSelectedCount > 0 && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 text-[11px] font-bold rounded-lg text-rose-500 hover:text-rose-600 hover:bg-rose-500/5"
                          onClick={() => clearGroupSelection(group)}
                        >
                          Clear
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Group Card Files List */}
                  {isExpanded && (
                    <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
                      {group.files.map((file) => {
                        const isChecked = !!selectedFiles[file.file_id];
                        
                        return (
                          <div 
                            key={file.file_id}
                            className={`p-4 flex items-center justify-between gap-4 transition-colors ${isChecked ? 'bg-rose-500/5 dark:bg-rose-500/5' : 'hover:bg-neutral-50/50 dark:hover:bg-neutral-900/10'}`}
                          >
                            <div className="flex items-center space-x-3 min-w-0">
                              <input
                                type="checkbox"
                                id={`check-${file.file_id}`}
                                checked={isChecked}
                                onChange={() => toggleFileSelection(file.file_id)}
                                className="w-4.5 h-4.5 rounded border-neutral-300 dark:border-neutral-700 text-rose-600 focus:ring-rose-500 shrink-0 cursor-pointer"
                              />
                              <div className="min-w-0 space-y-1">
                                <label
                                  htmlFor={`check-${file.file_id}`}
                                  className="text-xs md:text-sm font-semibold text-neutral-700 dark:text-neutral-300 break-all hover:text-neutral-900 cursor-pointer flex items-center space-x-1"
                                >
                                  <span>{file.filename}</span>
                                </label>
                                <div className="flex items-center flex-wrap gap-x-2 gap-y-1 text-xs text-neutral-400">
                                  <span className="flex items-center space-x-1">
                                    <FolderOpen size={12} className="shrink-0" />
                                    <span className="truncate max-w-[120px] md:max-w-[240px]">{file.virtual_path}</span>
                                  </span>
                                  <span>•</span>
                                  <span className="flex items-center space-x-1">
                                    <Calendar size={12} className="shrink-0" />
                                    <span>{formatLocalTime(file.created_at)}</span>
                                  </span>
                                  <div className="flex items-center space-x-1">
                                    {getFileBadges(file, group.files)}
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="shrink-0">
                              <Link 
                                href={`/files?path=${encodeURIComponent(file.virtual_path === '/' ? '' : file.virtual_path)}`}
                                className="p-2 text-neutral-400 hover:text-primary rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 block transition-colors"
                                title="Go to folder"
                              >
                                <ExternalLink size={16} />
                              </Link>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 5. FLOATING BULK MANUAL ACTIONS TOOLBAR */}
      {totalSelectedCount > 0 && (
        <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-bottom duration-300">
          <div className="flex items-center space-x-4 px-6 py-3 bg-neutral-950/90 dark:bg-neutral-900/90 backdrop-blur-xl border border-white/10 shadow-2xl rounded-full text-white">
            <div className="flex items-center space-x-2 shrink-0">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[10px] font-black text-white">
                {totalSelectedCount}
              </span>
              <span className="text-xs font-bold tracking-tight">Files selected</span>
            </div>
            
            <div className="h-4 w-px bg-white/10" />

            <div className="flex items-center space-x-2">
              <Button
                size="sm"
                variant="ghost"
                className="h-8 text-xs font-bold text-neutral-400 hover:text-white hover:bg-white/5 rounded-full px-3"
                onClick={() => setSelectedFiles({})}
              >
                Deselect All
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="h-8 text-xs font-bold rounded-full px-4 bg-rose-500 hover:bg-rose-600 text-white shadow-lg shadow-rose-500/20"
                onClick={handleManualCleanup}
                disabled={cleanupMutation.isPending}
              >
                {cleanupMutation.isPending ? (
                  <Loader2 className="animate-spin mr-1.5" size={14} />
                ) : (
                  <Trash2 className="mr-1.5" size={14} />
                )}
                Trash Selected
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
