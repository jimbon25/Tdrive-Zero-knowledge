"use client";

import React, { useState, useRef, useEffect } from "react";
import { Plus, FolderPlus, FileUp, FolderUp, RefreshCw, Loader2, AlertTriangle, ExternalLink } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import toast from "react-hot-toast";
import { useUIStore } from "@/store/useUIStore";
import { cn, Button } from "@/components/ui";
import { Dialog } from "@/components/ui/Dialog";
import { useRouter } from "next/navigation";

interface NewActionMenuProps {
  currentPath: string;
  onCreateFolder: () => void;
  onRefresh: () => void;
}

interface DuplicateInfo {
  file: File;
  existingFile: {
    file_id: string;
    filename: string;
    virtual_path: string;
  };
  vpath: string;
}

const calculateSHA256 = async (file: File): Promise<string> => {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
};

export function NewActionMenu({ currentPath, onCreateFolder, onRefresh }: NewActionMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isHashing, setIsHashing] = useState(false);
  const [uploadQueue, setUploadQueue] = useState<{ file: File; vpath: string }[]>([]);
  const [currentDuplicate, setCurrentDuplicate] = useState<DuplicateInfo | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const menuItemsRef = useRef<(HTMLButtonElement | null)[]>([]);

  const queryClient = useQueryClient();
  const router = useRouter();
  const { addActiveUpload } = useUIStore();

  // Handle directory attribute for folder upload input
  useEffect(() => {
    if (folderInputRef.current) {
      folderInputRef.current.setAttribute("webkitdirectory", "");
      folderInputRef.current.setAttribute("directory", "");
    }
  }, []);

  // Close menu on click outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [isOpen]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        setIsOpen(true);
        setActiveIndex(0);
      }
      return;
    }

    if (e.key === "Escape") {
      e.preventDefault();
      setIsOpen(false);
      triggerRef.current?.focus();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const nextIndex = (activeIndex + 1) % 4;
      setActiveIndex(nextIndex);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prevIndex = (activeIndex - 1 + 4) % 4;
      setActiveIndex(prevIndex);
    } else if (e.key === "Tab") {
      setIsOpen(false);
    }
  };

  useEffect(() => {
    if (isOpen && activeIndex >= 0) {
      menuItemsRef.current[activeIndex]?.focus();
    }
  }, [isOpen, activeIndex]);

  const uploadMutation = useMutation({
    mutationFn: async ({ file, vpath }: { file: File; vpath: string }) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("vpath", vpath);
      
      const response = await api.post("/files/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return response.data.data;
    },
    onSuccess: (jobId) => {
      toast.success("Upload initiated");
      addActiveUpload(jobId);
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["files"] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || "Upload failed");
    },
  });

  const processNextQueueItem = async (queue: { file: File; vpath: string }[]) => {
    if (queue.length === 0) {
      setIsHashing(false);
      toast.dismiss("upload-status");
      return;
    }

    const item = queue[0];
    setIsHashing(true);
    toast.loading(`Analyzing ${item.file.name}...`, { id: "upload-status" });

    try {
      const sha256 = await calculateSHA256(item.file);
      const response = await api.get(`/files/precheck?sha256=${sha256}`);
      const existingFile = response.data.data;

      if (existingFile) {
        setCurrentDuplicate({ file: item.file, existingFile, vpath: item.vpath });
        toast.dismiss("upload-status");
      } else {
        uploadMutation.mutate({ file: item.file, vpath: item.vpath });
        const nextQueue = queue.slice(1);
        setUploadQueue(nextQueue);
        processNextQueueItem(nextQueue);
      }
    } catch (err) {
      uploadMutation.mutate({ file: item.file, vpath: item.vpath });
      const nextQueue = queue.slice(1);
      setUploadQueue(nextQueue);
      processNextQueueItem(nextQueue);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const items = Array.from(files).map(file => ({ file, vpath: currentPath }));
      setUploadQueue(items);
      setIsOpen(false);
      processNextQueueItem(items);
      e.target.value = "";
    }
  };

  const handleFolderChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setIsOpen(false);
      setIsHashing(true);
      const fileList = Array.from(files);

      // Identify subfolders to create
      const foldersToCreate = new Set<string>();
      fileList.forEach(file => {
        const relPath = file.webkitRelativePath;
        const parts = relPath.split('/');
        parts.pop();
        let current = "";
        parts.forEach(part => {
          current = current ? `${current}/${part}` : part;
          foldersToCreate.add(current);
        });
      });

      const sortedFolders = Array.from(foldersToCreate).sort((a, b) => a.split('/').length - b.split('/').length);
      
      toast.loading("Structuring directories...", { id: "upload-status" });
      
      for (const folder of sortedFolders) {
        const parts = folder.split('/');
        const folderName = parts.pop()!;
        const relativeParent = parts.join('/');
        const vpath = relativeParent 
          ? (currentPath === '/' ? '/' + relativeParent : currentPath + '/' + relativeParent) 
          : currentPath;
          
        try {
          await api.post("/files/folder", { name: folderName, vpath });
        } catch (err) {
          // Ignore duplicates
        }
      }

      // Prepare file upload queue with their nested vpaths
      const queueItems = fileList.map(file => {
        const relPath = file.webkitRelativePath;
        const parts = relPath.split('/');
        parts.pop();
        const subPath = parts.join('/');
        const fileVpath = subPath 
          ? (currentPath === '/' ? '/' + subPath : currentPath + '/' + subPath) 
          : currentPath;
        return { file, vpath: fileVpath };
      });

      setUploadQueue(queueItems);
      processNextQueueItem(queueItems);
      e.target.value = "";
    }
  };

  const handleDuplicateResolve = (action: 'anyway' | 'open' | 'cancel') => {
    if (!currentDuplicate) return;

    if (action === 'anyway') {
      uploadMutation.mutate({ file: currentDuplicate.file, vpath: currentDuplicate.vpath });
    } else if (action === 'open') {
      const path = currentDuplicate.existingFile.virtual_path;
      router.push(`/files?path=${encodeURIComponent(path === '/' ? '' : path)}`);
    }

    const nextQueue = uploadQueue.slice(1);
    setUploadQueue(nextQueue);
    setCurrentDuplicate(null);
    processNextQueueItem(nextQueue);
  };

  const formatSize = (bytes: number) => {
    if (!bytes) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const isPending = uploadMutation.isPending || isHashing;

  return (
    <div className="relative" ref={containerRef} onKeyDown={handleKeyDown}>
      {/* Hidden inputs */}
      <input
        type="file"
        multiple
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
      />
      <input
        type="file"
        multiple
        ref={folderInputRef}
        onChange={handleFolderChange}
        className="hidden"
      />

      {/* Main trigger button */}
      <button
        ref={triggerRef}
        onClick={() => setIsOpen(!isOpen)}
        disabled={isPending}
        aria-haspopup="true"
        aria-expanded={isOpen}
        className={cn(
          "flex items-center space-x-3 px-5 h-12 bg-primary text-white rounded-2xl shadow-lg hover:shadow-primary/20 hover:bg-primary/95 transition-all active:scale-95 shrink-0 select-none",
          isPending && "opacity-50 cursor-not-allowed"
        )}
      >
        <div className="flex items-center justify-center shrink-0">
          {isPending ? (
            <Loader2 size={18} className="animate-spin text-white" />
          ) : (
            <Plus size={20} strokeWidth={2.5} className="text-white" />
          )}
        </div>
        <span className="font-bold text-sm tracking-tight text-white">
          {isPending ? "Uploading..." : "New"}
        </span>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div 
          role="menu"
          className="absolute right-0 mt-2 w-52 bg-white/90 dark:bg-neutral-900/95 backdrop-blur-xl border border-neutral-200/50 dark:border-neutral-800/50 rounded-2xl shadow-xl shadow-neutral-200/30 dark:shadow-black/50 z-50 p-1.5 focus:outline-none animate-in fade-in slide-in-from-top-2 duration-150"
        >
          <button
            role="menuitem"
            ref={(el) => { menuItemsRef.current[0] = el; }}
            onClick={() => { setIsOpen(false); onCreateFolder(); }}
            className="w-full flex items-center space-x-3 px-3.5 py-2.5 text-left text-xs font-bold text-neutral-600 dark:text-neutral-300 hover:text-primary hover:bg-primary/5 dark:hover:bg-primary/10 rounded-xl transition-all outline-none focus:bg-primary/5 focus:text-primary dark:focus:bg-primary/10"
          >
            <FolderPlus size={16} />
            <span>New Folder</span>
          </button>

          <button
            role="menuitem"
            ref={(el) => { menuItemsRef.current[1] = el; }}
            onClick={() => { setIsOpen(false); fileInputRef.current?.click(); }}
            className="w-full flex items-center space-x-3 px-3.5 py-2.5 text-left text-xs font-bold text-neutral-600 dark:text-neutral-300 hover:text-primary hover:bg-primary/5 dark:hover:bg-primary/10 rounded-xl transition-all outline-none focus:bg-primary/5 focus:text-primary dark:focus:bg-primary/10"
          >
            <FileUp size={16} />
            <span>Upload File</span>
          </button>

          <button
            role="menuitem"
            ref={(el) => { menuItemsRef.current[2] = el; }}
            onClick={() => { setIsOpen(false); folderInputRef.current?.click(); }}
            className="w-full flex items-center space-x-3 px-3.5 py-2.5 text-left text-xs font-bold text-neutral-600 dark:text-neutral-300 hover:text-primary hover:bg-primary/5 dark:hover:bg-primary/10 rounded-xl transition-all outline-none focus:bg-primary/5 focus:text-primary dark:focus:bg-primary/10"
          >
            <FolderUp size={16} />
            <span>Upload Folder</span>
          </button>

          <div className="h-px bg-neutral-150 dark:bg-neutral-800 my-1 mx-1" />

          <button
            role="menuitem"
            ref={(el) => { menuItemsRef.current[3] = el; }}
            onClick={() => { setIsOpen(false); onRefresh(); }}
            className="w-full flex items-center space-x-3 px-3.5 py-2.5 text-left text-xs font-bold text-neutral-600 dark:text-neutral-300 hover:text-primary hover:bg-primary/5 dark:hover:bg-primary/10 rounded-xl transition-all outline-none focus:bg-primary/5 focus:text-primary dark:focus:bg-primary/10"
          >
            <RefreshCw size={16} />
            <span>Refresh</span>
          </button>
        </div>
      )}

      {/* Duplicate Warning Dialog */}
      <Dialog
        isOpen={!!currentDuplicate}
        onClose={() => handleDuplicateResolve('cancel')}
      >
        <div className="p-8 space-y-6 text-left">
          <div className="flex items-center space-x-3 text-amber-500">
            <div className="p-2 bg-amber-500/10 rounded-xl">
              <AlertTriangle size={24} />
            </div>
            <h3 className="text-lg font-black tracking-tight text-neutral-900 dark:text-white">Duplicate File Warning</h3>
          </div>

          <div className="space-y-3">
            <p className="text-sm text-neutral-500 dark:text-neutral-400 font-medium">
              A file with the exact same content (SHA256) already exists in your storage.
            </p>
            
            <div className="p-4 bg-neutral-50 dark:bg-neutral-900/50 rounded-2xl border border-neutral-100 dark:border-neutral-800 space-y-2 text-xs">
              <div>
                <span className="font-bold text-neutral-400 uppercase tracking-wider block text-[9px]">File to upload</span>
                <span className="font-bold text-neutral-850 dark:text-neutral-200 break-all">{currentDuplicate?.file.name}</span>
                <span className="text-neutral-400 ml-1">({currentDuplicate ? formatSize(currentDuplicate.file.size) : ""})</span>
              </div>
              
              <div className="h-px bg-neutral-200 dark:bg-neutral-800 my-2" />

              <div>
                <span className="font-bold text-neutral-400 uppercase tracking-wider block text-[9px]">Existing file location</span>
                <span className="font-bold text-neutral-800 dark:text-neutral-200 break-all">{currentDuplicate?.existingFile.filename}</span>
                <div className="text-neutral-400 mt-0.5 flex items-center space-x-1">
                  <span>Folder:</span>
                  <span className="underline italic">{currentDuplicate?.existingFile.virtual_path}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Button
              variant="default"
              className="w-full rounded-xl font-bold h-11 flex items-center justify-center space-x-2 shadow-lg shadow-primary/10"
              onClick={() => handleDuplicateResolve('open')}
            >
              <span>Open Existing File</span>
              <ExternalLink size={16} />
            </Button>
            
            <Button
              variant="outline"
              className="w-full rounded-xl font-bold h-11 border-neutral-200 dark:border-neutral-800"
              onClick={() => handleDuplicateResolve('anyway')}
            >
              Upload Anyway
            </Button>

            <Button
              variant="ghost"
              className="w-full rounded-xl font-bold h-11 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              onClick={() => handleDuplicateResolve('cancel')}
            >
              Cancel
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
