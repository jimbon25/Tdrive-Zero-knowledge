"use client";

import React from "react";
import { useFiles } from "@/hooks/api/useFiles";
import { FileItem } from "@/components/explorer/FileItem";
import { Breadcrumbs } from "@/components/explorer/Breadcrumbs";
import { NewActionMenu } from "@/components/operations/NewActionMenu";
import { MoveDialog } from "@/components/explorer/MoveDialog";
import { PreviewModal } from "@/components/explorer/PreviewModal";
import { useUIStore } from "@/store/useUIStore";
import { useNotificationStore } from "@/store/useNotificationStore";
import { useSelectionStore } from "@/store/useSelectionStore";
import { BulkActionToolbar } from "@/components/explorer/BulkActionToolbar";
import { 
  LayoutGrid, 
  List as ListIcon, 
  Loader2, 
  FolderOpen,
  ArrowUpDown,
  Info,
  FolderPlus,
  ArrowLeft,
  Trash,
  Star,
  StarOff,
  Download,
  X,
  CheckSquare,
  Square
} from "lucide-react";
import { Button, cn } from "@/components/ui";
import { FileItem as FileType } from "@/types";
import { api } from "@/lib/axios";
import toast from "react-hot-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

export default function FilesPage({ params }: { params: { path?: string[] } }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const currentPathSegments = params.path || [];
  const virtualPath = "/" + currentPathSegments.join("/");
  
  const { data: files, isLoading, error, refetch } = useFiles(virtualPath);
  const { viewMode, setViewMode, searchQuery } = useUIStore();
  const { prompt, confirm, addNotification } = useNotificationStore();
  const { selectedIds, clearSelection, isSelectionMode, setSelectedIds } = useSelectionStore();
  const [isMoveOpen, setIsMoveOpen] = React.useState(false);
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
      queryClient.invalidateQueries({ queryKey: ["files", virtualPath] });
      queryClient.invalidateQueries({ queryKey: ["trash"] });
      setPreviewFile(null);
    }
  };

  const selectedItems = React.useMemo(() => {
    return files ? files.filter(f => selectedIds.includes(f.file_id)) : [];
  }, [files, selectedIds]);

  // Reset selection on navigation
  React.useEffect(() => {
    clearSelection();
  }, [virtualPath, clearSelection]);

  const createFolderMutation = useMutation({
    mutationFn: async (name: string) => {
      const response = await api.post("/files/folder", { name, vpath: virtualPath });
      return response.data;
    },
    onSuccess: () => {
      toast.success("Folder created");
      queryClient.invalidateQueries({ queryKey: ["files", virtualPath] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || "Failed to create folder");
    }
  });

  const bulkStarMutation = useMutation({
    mutationFn: async (starred: boolean) => {
      await Promise.all(selectedIds.map(id => 
        starred ? api.post(`/files/${id}/star`) : api.delete(`/files/${id}/star`)
      ));
    },
    onSuccess: () => {
      toast.success("Updated favorites");
      queryClient.invalidateQueries({ queryKey: ["files", virtualPath] });
      clearSelection();
    }
  });

  const bulkTrashMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post("/files/bulk-trash", { file_ids: selectedIds });
      return response.data;
    },
    onSuccess: (data: any) => {
      toast.success(`Moved ${data.data.count} items to trash`);
      addNotification({
        type: "info",
        title: "Bulk Trash",
        message: `${data.data.count} items moved to trash bin.`
      });
      queryClient.invalidateQueries({ queryKey: ["files", virtualPath] });
      queryClient.invalidateQueries({ queryKey: ["system-status"] });
      clearSelection();
    },
    onError: (err: any) => {
      toast.error("Bulk trash failed");
    }
  });

  const handleBulkDownload = async () => {
    try {
      toast.loading("Preparing ZIP archive...");
      const response = await api.post("/files/bulk-download", { file_ids: selectedIds }, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `tdrive_bulk_${Date.now()}.zip`);
      document.body.appendChild(link);
      link.click();
      toast.dismiss();
      toast.success("Download started");
    } catch (e) {
      toast.dismiss();
      toast.error("Bulk download failed");
    }
  };

  const handleCreateFolder = async () => {
    const name = await prompt({
      title: "New Folder",
      message: "Enter a name for the new folder:",
      placeholder: "Folder name...",
      confirmLabel: "Create"
    });
    
    if (name && name.trim()) {
      createFolderMutation.mutate(name.trim());
    }
  };

  const handleSelectAll = () => {
    if (!files) return;
    if (selectedIds.length === files.length) {
      clearSelection();
    } else {
      setSelectedIds(files.map(f => f.file_id));
    }
  };

  const filteredFiles = React.useMemo(() => {
    if (!files) return [];
    if (!searchQuery) return files;
    
    const query = searchQuery.toLowerCase();
    const shouldShowOnlyStarred = query.includes("starred:true");
    const cleanQuery = query.replace("starred:true", "").trim();

    return files.filter((f: any) => {
      const matchesName = f.filename.toLowerCase().includes(cleanQuery);
      const matchesStarred = !shouldShowOnlyStarred || f.is_starred;
      return matchesName && matchesStarred;
    });
  }, [files, searchQuery]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      {/* 1. Bulk Actions Toolbar (Sticky) */}
      <BulkActionToolbar 
        selectedCount={selectedIds.length}
        onClear={clearSelection}
        onDownload={handleBulkDownload}
        onStar={() => bulkStarMutation.mutate(true)}
        onUnstar={() => bulkStarMutation.mutate(false)}
        onMove={() => setIsMoveOpen(true)}
        onTrash={async () => {
          if (await confirm({ title: "Move to Trash?", message: `Do you want to move ${selectedIds.length} items to the trash?` })) {
            bulkTrashMutation.mutate();
          }
        }}
      />

      {/* 2. Tool Bar Area */}
      <div className="flex flex-col space-y-4">
        <div className="flex items-center justify-between">
          <Breadcrumbs path={currentPathSegments} />
          
          <div className="flex items-center space-x-2">
            <div className="hidden md:flex items-center bg-neutral-100 dark:bg-neutral-800 p-1 rounded-lg border border-neutral-200 dark:border-neutral-700">
              <button
                onClick={() => setViewMode("list")}
                className={cn(
                  "p-1.5 rounded-md transition-all",
                  viewMode === "list" ? "bg-card shadow-sm text-primary" : "text-neutral-500 hover:text-foreground"
                )}
              >
                <ListIcon size={18} />
              </button>
              <button
                onClick={() => setViewMode("grid")}
                className={cn(
                  "p-1.5 rounded-md transition-all",
                  viewMode === "grid" ? "bg-card shadow-sm text-primary" : "text-neutral-500 hover:text-foreground"
                )}
              >
                <LayoutGrid size={18} />
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
             {currentPathSegments.length > 0 && (
               <Button 
                 variant="ghost" 
                 size="icon" 
                 className="rounded-full"
                 onClick={() => router.back()}
               >
                 <ArrowLeft size={20} />
               </Button>
             )}
             <h1 className="text-xl md:text-2xl font-bold tracking-tight truncate max-w-[200px] md:max-w-md">
              {currentPathSegments.length > 0 
                ? decodeURIComponent(currentPathSegments[currentPathSegments.length - 1]) 
                : "My Drive"}
            </h1>
          </div>
          
          <div className="flex items-center space-x-2">
            {!isSelectionMode && (
              <NewActionMenu 
                currentPath={virtualPath} 
                onCreateFolder={handleCreateFolder} 
                onRefresh={refetch} 
              />
            )}
            {isSelectionMode && (
               <Button 
                 variant="ghost" 
                 className="rounded-2xl h-12 font-bold text-neutral-500"
                 onClick={clearSelection}
               >
                 Cancel Selection
               </Button>
            )}
          </div>
        </div>
      </div>

      {/* 3. File Content Area */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-32 text-neutral-400">
          <Loader2 className="animate-spin mb-4" size={40} strokeWidth={1.5} />
          <p className="text-sm font-medium animate-pulse">Syncing with Telegram...</p>
        </div>
      ) : error ? (
        <div className="p-8 bg-destructive/5 text-destructive border border-destructive/20 rounded-2xl flex items-center space-x-4">
          <Info size={24} />
          <div>
            <p className="font-bold">Sync Error</p>
            <p className="text-sm opacity-80">Unable to reach the TDrive agent.</p>
          </div>
        </div>
      ) : filteredFiles.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 bg-neutral-50/50 dark:bg-neutral-900/20 border-2 border-dashed border-neutral-200 dark:border-neutral-800 rounded-3xl text-neutral-400">
          <FolderOpen size={64} strokeWidth={1} className="mb-4 opacity-20" />
          <p className="text-lg font-medium">No items found</p>
          <p className="text-sm">Upload a file or create a folder.</p>
          <Button variant="link" className="mt-4 text-primary font-bold md:hidden" onClick={handleCreateFolder}>
             Create Folder
          </Button>
        </div>
      ) : (
        <>
          {/* List View Table Header (Desktop Only) */}
          {viewMode === "list" && (
            <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-2 text-xs font-bold text-neutral-400 uppercase tracking-widest border-b border-neutral-100 dark:border-neutral-800 mb-2 sticky top-0 bg-background/80 backdrop-blur-md z-10">
              <div className="col-span-6 flex items-center space-x-4">
                <button 
                  onClick={handleSelectAll}
                  className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-md transition-colors text-neutral-500"
                >
                   {files && selectedIds.length === files.length ? <CheckSquare size={16} className="text-primary" /> : <Square size={16} />}
                </button>
                <div className="flex items-center space-x-2 cursor-pointer hover:text-primary transition-colors text-left">
                  <span>Name</span>
                  <ArrowUpDown size={12} />
                </div>
              </div>
              <div className="col-span-2 text-left">Size</div>
              <div className="col-span-3 text-left">Uploaded At</div>
              <div className="col-span-1 text-left"></div>
            </div>
          )}

          <div className={cn(
            "grid gap-2 md:gap-3 transition-all duration-300",
            viewMode === "grid" 
              ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7" 
              : "grid-cols-1"
          )}>
            {filteredFiles.map((file: FileType) => (
              <FileItem 
                key={file.file_id} 
                file={file} 
                viewMode={viewMode}
                currentPath={virtualPath}
                onPreview={setPreviewFile}
                onMove={setMoveFile}
              />
            ))}
          </div>
        </>
      )}

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
        isOpen={isMoveOpen || !!moveFile}
        onClose={() => {
          setIsMoveOpen(false);
          setMoveFile(null);
          clearSelection();
        }}
        items={moveFile ? [moveFile] : selectedItems}
        currentPath={virtualPath}
      />
    </div>
  );
}
