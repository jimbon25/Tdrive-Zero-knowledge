"use client";

import React, { useState } from "react";
import { Plus, Loader2, AlertTriangle, ExternalLink } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import toast from "react-hot-toast";
import { useUIStore } from "@/store/useUIStore";
import { Button, cn } from "@/components/ui";
import { useRouter } from "next/navigation";
import { DuplicateWarningDialog, DuplicateInfo } from "@/components/shared/DuplicateWarningDialog";
import { formatSize, calculateSHA256 } from "@/lib/fileUtils";

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

      <DuplicateWarningDialog
        duplicateInfo={duplicateInfo}
        onOpenExisting={handleOpenExisting}
        onUploadAnyway={handleUploadAnyway}
        onCancel={() => setDuplicateInfo(null)}
        formatSize={formatSize}
      />
    </div>
  );
}
