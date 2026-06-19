"use client";

import React, { useState } from "react";
import { Plus, Loader2, AlertTriangle, ExternalLink } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import toast from "react-hot-toast";
import { useUIStore } from "@/store/useUIStore";
import { Button, cn } from "@/components/ui";
import { Dialog } from "@/components/ui/Dialog";
import { useRouter } from "next/navigation";

interface DuplicateInfo {
  file: File;
  existingFile: {
    file_id: string;
    filename: string;
    virtual_path: string;
  };
}

const calculateSHA256 = async (file: File): Promise<string> => {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
};

export function UploadButton({ currentPath }: { currentPath: string }) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const router = useRouter();
  const { addActiveUpload } = useUIStore();
  const [isHashing, setIsHashing] = useState(false);
  const [duplicateInfo, setDuplicateInfo] = useState<DuplicateInfo | null>(null);

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("vpath", currentPath);
      
      const response = await api.post("/files/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return response.data.data;
    },
    onSuccess: (jobId) => {
      toast.success("Upload started");
      addActiveUpload(jobId);
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["files", currentPath] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || "Upload failed");
    },
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setIsHashing(true);
      const fileList = Array.from(files);
      
      try {
        for (const file of fileList) {
          const sha256 = await calculateSHA256(file);
          const response = await api.get(`/files/precheck?sha256=${sha256}`);
          const existingFile = response.data.data;
          
          if (existingFile) {
            setDuplicateInfo({ file, existingFile });
            setIsHashing(false);
            e.target.value = "";
            return;
          } else {
            uploadMutation.mutate(file);
          }
        }
      } catch (err) {
        if (fileList[0]) {
          uploadMutation.mutate(fileList[0]);
        }
      } finally {
        setIsHashing(false);
        e.target.value = "";
      }
    }
  };

  const formatSize = (bytes: number) => {
    if (!bytes) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const handleOpenExisting = () => {
    if (!duplicateInfo) return;
    const path = duplicateInfo.existingFile.virtual_path;
    const targetUrl = `/files?path=${encodeURIComponent(path === '/' ? '' : path)}`;
    router.push(targetUrl);
    setDuplicateInfo(null);
  };

  const handleUploadAnyway = () => {
    if (!duplicateInfo) return;
    uploadMutation.mutate(duplicateInfo.file);
    setDuplicateInfo(null);
  };

  const isLoading = uploadMutation.isPending || isHashing;

  return (
    <div className="relative">
      <input
        type="file"
        multiple
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
      />
      
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={isLoading}
        className={cn(
          "flex items-center space-x-3 px-5 h-12 md:h-14 bg-card hover:bg-neutral-50 dark:hover:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-sm hover:shadow-md transition-all active:scale-95 group",
          isLoading && "opacity-50 cursor-not-allowed"
        )}
      >
        <div className="p-1.5 bg-primary/10 text-primary rounded-lg group-hover:scale-110 transition-transform">
          {isLoading ? (
            <Loader2 size={20} className="animate-spin" />
          ) : (
            <Plus size={24} strokeWidth={2.5} />
          )}
        </div>
        <span className="hidden md:block font-bold text-sm text-neutral-700 dark:text-neutral-300">
          {isHashing ? "Hashing file..." : "New Upload"}
        </span>
        <span className="md:hidden font-bold text-sm text-primary">
          {isHashing ? "Hashing..." : "Upload"}
        </span>
      </button>

      {/* DUPLICATE WARNING MODAL */}
      <Dialog
        isOpen={!!duplicateInfo}
        onClose={() => setDuplicateInfo(null)}
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
                <span className="font-bold text-neutral-800 dark:text-neutral-200 break-all">{duplicateInfo?.file.name}</span>
                <span className="text-neutral-400 ml-1">({duplicateInfo ? formatSize(duplicateInfo.file.size) : ""})</span>
              </div>
              
              <div className="h-px bg-neutral-200 dark:bg-neutral-800 my-2" />

              <div>
                <span className="font-bold text-neutral-400 uppercase tracking-wider block text-[9px]">Existing file location</span>
                <span className="font-bold text-neutral-850 dark:text-neutral-150 break-all">{duplicateInfo?.existingFile.filename}</span>
                <div className="text-neutral-400 mt-0.5 flex items-center space-x-1">
                  <span>Folder:</span>
                  <span className="underline italic">{duplicateInfo?.existingFile.virtual_path}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Button
              variant="default"
              className="w-full rounded-xl font-bold h-11 flex items-center justify-center space-x-2 shadow-lg shadow-primary/10"
              onClick={handleOpenExisting}
            >
              <span>Open Existing File</span>
              <ExternalLink size={16} />
            </Button>
            
            <Button
              variant="outline"
              className="w-full rounded-xl font-bold h-11 border-neutral-200 dark:border-neutral-800"
              onClick={handleUploadAnyway}
            >
              Upload Anyway
            </Button>

            <Button
              variant="ghost"
              className="w-full rounded-xl font-bold h-11 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              onClick={() => setDuplicateInfo(null)}
            >
              Cancel
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
