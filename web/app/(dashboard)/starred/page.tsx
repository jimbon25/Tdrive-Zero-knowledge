"use client";

import React, { useMemo } from "react";
import { useStarredFiles } from "@/hooks/api/useFiles";
import { FileItem } from "@/components/explorer/FileItem";
import { PreviewModal } from "@/components/explorer/PreviewModal";
import { MoveDialog } from "@/components/explorer/MoveDialog";
import { FileItem as FileType } from "@/types";
import { useUIStore } from "@/store/useUIStore";
import { useSelectionStore } from "@/store/useSelectionStore";
import { BulkActionToolbar } from "@/components/explorer/BulkActionToolbar";
import { 
  LayoutGrid, 
  List as ListIcon, 
  Loader2, 
  Star,
  Download,
  Trash,
  X,
  CheckSquare,
  Square
} from "lucide-react";
import { Button, cn } from "@/components/ui";
import { api } from "@/lib/axios";
import toast from "react-hot-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNotificationStore } from "@/store/useNotificationStore";

export default function StarredPage() {
  const queryClient = useQueryClient();
  const { data: files, isLoading } = useStarredFiles();
  const { viewMode, setViewMode, searchQuery } = useUIStore();
  const { selectedIds, clearSelection, isSelectionMode, setSelectedIds } = useSelectionStore();
  const { confirm, addNotification } = useNotificationStore();
  const [previewFile, setPreviewFile] = React.useState<FileType | null>(null);
  const [moveFile, setMoveFile] = React.useState<FileType | null>(null);

  const handleDownload = async (file: FileType) => {
    try {
      const response = await api.post(`/files/${file.file_id}/ticket`);
      const { ticket } = response.data.data;
      window.location.href = `${api.defaults.baseURL}/download/${ticket}`;
    } catch (error) {
      toast.error("Download unavailable");
    }
  };

  const handleDelete = async (file: FileType) => {
    const isConfirmed = await confirm({
      title: "Move to Trash?",
      message: `Do you want to move "${file.filename}" to the Trash Bin?`,
      confirmLabel: "Move to Trash"
    });
    if (isConfirmed) {
      await api.delete(`/files/${file.file_id}`);
      queryClient.invalidateQueries({ queryKey: ["files"] });
      queryClient.invalidateQueries({ queryKey: ["trash"] });
      setPreviewFile(null);
    }
  };

  const filteredFiles = useMemo(() => {
    if (!files) return [];
    if (!searchQuery) return files;
    
    const cleanQuery = searchQuery.toLowerCase().replace("starred:true", "").trim();
    
    return files.filter((f: any) =>
      f.filename.toLowerCase().includes(cleanQuery)
    );
  }, [files, searchQuery]);

  const bulkTrashMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post("/files/bulk-trash", { file_ids: selectedIds });
      return response.data;
    },
    onSuccess: (data: any) => {
      toast.success(`Moved ${data.data.count} items to trash`);
      queryClient.invalidateQueries({ queryKey: ["files"] });
      queryClient.invalidateQueries({ queryKey: ["system-status"] });
      clearSelection();
    },
  });

  const bulkUnstarMutation = useMutation({
    mutationFn: async () => {
      await Promise.all(selectedIds.map(id => api.delete(`/files/${id}/star`)));
    },
    onSuccess: () => {
      toast.success("Removed from favorites");
      queryClient.invalidateQueries({ queryKey: ["files"] });
      clearSelection();
    }
  });

  const handleBulkDownload = async () => {
    try {
      toast.loading("Preparing ZIP archive...");
      const response = await api.post("/files/bulk-download", { file_ids: selectedIds }, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `tdrive_starred_bulk_${Date.now()}.zip`);
      document.body.appendChild(link);
      link.click();
      toast.dismiss();
      toast.success("Download started");
    } catch (e) {
      toast.dismiss();
      toast.error("Bulk download failed");
    }
  };

  const handleSelectAll = () => {
    if (!filteredFiles) return;
    if (selectedIds.length === filteredFiles.length) {
      clearSelection();
    } else {
      setSelectedIds(filteredFiles.map(f => f.file_id));
    }
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* 1. Page Header */}
      <header className="px-4 md:px-8 py-4 md:py-6 border-b shrink-0 bg-card/50 backdrop-blur-md sticky top-0 z-30">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div className="w-10 h-10 md:w-12 md:h-12 bg-amber-500/10 rounded-2xl flex items-center justify-center text-amber-500 shadow-inner">
              <Star size={24} fill="currentColor" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-black tracking-tight">Starred</h1>
              <p className="text-[10px] md:text-xs text-neutral-400 font-bold uppercase tracking-widest flex items-center">
                 Your Favorite Files
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <div className="bg-neutral-100 dark:bg-neutral-800 p-1 rounded-xl flex">
              <Button 
                variant={viewMode === "grid" ? "outline" : "ghost"} 
                size="sm" 
                className="rounded-lg h-8 w-8 p-0"
                onClick={() => setViewMode("grid")}
              >
                <LayoutGrid size={16} />
              </Button>
              <Button 
                variant={viewMode === "list" ? "outline" : "ghost"} 
                size="sm" 
                className="rounded-lg h-8 w-8 p-0"
                onClick={() => setViewMode("list")}
              >
                <ListIcon size={16} />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* 2. Bulk Actions Bar */}
      <BulkActionToolbar 
        selectedCount={selectedIds.length}
        onClear={clearSelection}
        onDownload={handleBulkDownload}
        onUnstar={() => bulkUnstarMutation.mutate()}
        onTrash={async () => {
          if (await confirm({ title: "Move to Trash?", message: `Do you want to move ${selectedIds.length} items to the trash?` })) {
            bulkTrashMutation.mutate();
          }
        }}
      />

      {/* 3. Main Content */}
      <main className="flex-1 overflow-y-auto px-4 md:px-8 py-6 scrollbar-none">
        {isLoading ? (
          <div className="h-full flex flex-col items-center justify-center space-y-4 opacity-50">
            <Loader2 className="animate-spin text-primary" size={40} />
            <p className="text-[10px] font-black uppercase tracking-[0.3em]">Loading Favorites...</p>
          </div>
        ) : filteredFiles.length > 0 ? (
          <div className={cn(
            "grid gap-4 pb-20",
            viewMode === "grid" ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6" : "grid-cols-1"
          )}>
            {/* Table Header for List View */}
            {viewMode === "list" && (
              <div className="hidden md:grid grid-cols-12 gap-3 px-4 py-2 text-[10px] font-black text-neutral-400 uppercase tracking-widest border-b mb-2">
                <div className="col-span-6 flex items-center">
                   <button onClick={handleSelectAll} className="mr-3 hover:text-primary transition-colors">
                      {selectedIds.length === filteredFiles.length ? <CheckSquare size={14} /> : <Square size={14} />}
                   </button>
                   Name
                </div>
                <div className="col-span-2">Size</div>
                <div className="col-span-3">Created At</div>
                <div className="col-span-1 text-right pr-4">Actions</div>
              </div>
            )}

            {filteredFiles.map((file) => (
              <FileItem 
                key={file.file_id} 
                file={file} 
                viewMode={viewMode} 
                currentPath={file.virtual_path}
                onPreview={setPreviewFile}
                onMove={setMoveFile}
              />
            ))}
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-6 animate-in fade-in zoom-in-95 duration-700">
            <div className="w-24 h-24 bg-neutral-100 dark:bg-neutral-900 rounded-[2.5rem] flex items-center justify-center text-neutral-300 dark:text-neutral-800">
              <Star size={48} strokeWidth={1} />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold">No starred items yet</h3>
              <p className="text-neutral-500 text-sm max-w-xs mx-auto font-medium">
                Add stars to items that you want to easily find later.
              </p>
            </div>
          </div>
        )}
      </main>

      {previewFile && (
        <PreviewModal 
          file={previewFile}
          isOpen={true}
          onClose={() => setPreviewFile(null)}
          onDownload={() => handleDownload(previewFile)}
          onDelete={() => handleDelete(previewFile)}
        />
      )}

      <MoveDialog 
        isOpen={!!moveFile}
        onClose={() => {
          setMoveFile(null);
        }}
        items={moveFile ? [moveFile] : []}
        currentPath={"/"}
      />
    </div>
  );
}
