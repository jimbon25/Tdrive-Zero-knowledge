"use client";

import React from "react";
import { FileItem as FileType } from "@/types";
import { useAllFolders } from "@/hooks/api/useFiles";
import { 
  X, 
  Folder, 
  ChevronRight, 
  Search, 
  Loader2,
  HelpCircle
} from "lucide-react";
import { Button, cn, Input } from "@/components/ui";
import { Dialog } from "@/components/ui/Dialog";
import { api } from "@/lib/axios";
import toast from "react-hot-toast";
import { useQueryClient } from "@tanstack/react-query";

interface MoveDialogProps {
  isOpen: boolean;
  onClose: () => void;
  items: FileType[];
  currentPath: string;
}

interface TreeNode {
  name: string;
  path: string;
  children: TreeNode[];
}

export function MoveDialog({ isOpen, onClose, items, currentPath }: MoveDialogProps) {
  const queryClient = useQueryClient();
  const { data: folders, isLoading, error } = useAllFolders();
  const [selectedPath, setSelectedPath] = React.useState<string>("/");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [isMoving, setIsMoving] = React.useState(false);
  const [showConfirm, setShowConfirm] = React.useState(false);
  
  const [expandedPaths, setExpandedPaths] = React.useState<Set<string>>(new Set(["/"]));

  React.useEffect(() => {
    if (isOpen) {
      setSelectedPath(currentPath || "/");
      setSearchQuery("");
      setShowConfirm(false);
      setIsMoving(false);
      setExpandedPaths(new Set(["/"]));
    }
  }, [isOpen, currentPath]);

  const isInvalidDestination = (destPath: string) => {
    return items.some(item => {
      const itemPath = item.virtual_path === "/" 
        ? `/${item.filename}` 
        : `${item.virtual_path.replace(/\/$/, "")}/${item.filename}`;
        
      if (destPath === item.virtual_path) return true;

      if (item.is_folder) {
        return destPath === itemPath || destPath.startsWith(itemPath + "/");
      }
      return false;
    });
  };

  const buildTree = (folderList: FileType[]): TreeNode => {
    const root: TreeNode = { name: "My Drive", path: "/", children: [] };
    
    const sorted = [...folderList].sort((a, b) => {
      const depthA = a.virtual_path.split("/").length;
      const depthB = b.virtual_path.split("/").length;
      return depthA - depthB;
    });
    
    const pathMap = new Map<string, TreeNode>();
    pathMap.set("/", root);
    
    sorted.forEach(f => {
      const parentPath = f.virtual_path;
      const fullPath = parentPath === "/" 
        ? `/${f.filename}` 
        : `${parentPath.replace(/\/$/, "")}/${f.filename}`;
      
      if (isInvalidDestination(fullPath)) {
        return;
      }
      
      const node: TreeNode = {
        name: f.filename,
        path: fullPath,
        children: []
      };
      
      pathMap.set(fullPath, node);
      const parentNode = pathMap.get(parentPath) || root;
      parentNode.children.push(node);
    });
    
    return root;
  };

  const folderTree = folders ? buildTree(folders) : { name: "My Drive", path: "/", children: [] };

  const toggleExpand = (path: string) => {
    setExpandedPaths(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const handleSelect = (path: string) => {
    setSelectedPath(path);
  };

  const handleMove = async () => {
    setIsMoving(true);
    try {
      const payload = {
        item_ids: items.map(i => i.file_id),
        target_path: selectedPath
      };

      const response = await api.post("/files/bulk-move", payload);
      
      if (response.data.success) {
        const count = response.data.data;
        toast.success(`Successfully moved ${count} items`);
        
        queryClient.invalidateQueries({ queryKey: ["files"] });
        queryClient.invalidateQueries({ queryKey: ["system-status"] });
        
        onClose();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || "Failed to move items");
    } finally {
      setIsMoving(false);
      setShowConfirm(false);
    }
  };

  const renderTreeNode = (node: TreeNode, depth: number) => {
    const isExpanded = expandedPaths.has(node.path);
    const isSelected = selectedPath === node.path;
    
    const childrenToRender = node.children.filter(child => {
      if (!searchQuery) return true;
      const matchesSearch = (n: TreeNode): boolean => {
        if (n.name.toLowerCase().includes(searchQuery.toLowerCase())) return true;
        return n.children.some(matchesSearch);
      };
      return matchesSearch(child);
    });
    
    const hasChildren = childrenToRender.length > 0;
    
    return (
      <div key={node.path} className="space-y-1">
        <div 
          onClick={() => handleSelect(node.path)}
          className={cn(
            "flex items-center space-x-2 py-2.5 px-3 rounded-2xl cursor-pointer transition-all active:scale-[0.98]",
            isSelected 
              ? "bg-primary text-white font-bold shadow-lg shadow-primary/25" 
              : "hover:bg-neutral-100 dark:hover:bg-neutral-900 text-neutral-700 dark:text-neutral-300"
          )}
          style={{ paddingLeft: `${Math.max(12, depth * 16)}px` }}
        >
          <button
            type="button"
            className={cn(
              "p-1 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition-transform shrink-0",
              !hasChildren && "opacity-0 pointer-events-none"
            )}
            onClick={(e) => {
              e.stopPropagation();
              toggleExpand(node.path);
            }}
          >
            <ChevronRight 
              size={16} 
              className={cn("transition-transform duration-200", isExpanded && "rotate-90")} 
            />
          </button>
          
          <Folder 
            size={18} 
            className={cn("shrink-0", isSelected ? "text-white" : "text-primary")} 
            fill={isSelected ? "currentColor" : "none"}
          />
          
          <span className="text-sm truncate select-none">{node.name}</span>
        </div>
        
        {hasChildren && isExpanded && (
          <div className="space-y-1">
            {childrenToRender.map(child => renderTreeNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const getConfirmationMessage = () => {
    const destName = selectedPath === "/" ? "My Drive" : selectedPath.split("/").pop();
    if (items.length === 1) {
      return `Move "${items[0].filename}" to "${destName}"?`;
    }
    return `Move ${items.length} items to "${destName}"?`;
  };

  return (
    <Dialog 
      isOpen={isOpen} 
      onClose={onClose}
      className="max-w-md max-h-[85vh]"
    >
      {/* Header */}
      <div className="p-6 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between shrink-0">
        <div className="space-y-1">
          <h3 className="text-lg font-black tracking-tight leading-tight">
            {items.length === 1 ? "Move Item" : `Move ${items.length} Items`}
          </h3>
          <p className="text-xs text-neutral-400 font-bold">
            Select destination folder
          </p>
        </div>
        <button 
          onClick={onClose}
          className="p-2 text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-900 rounded-full transition-colors"
        >
          <X size={20} />
        </button>
      </div>

      {/* Content Body */}
      {!showConfirm ? (
        <>
          {/* Search Input */}
          <div className="px-6 pt-4 pb-2 shrink-0">
            <div className="relative">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" />
              <Input 
                placeholder="Search folders..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-11 pr-4 h-11 rounded-xl border-neutral-200 focus:ring-primary/20 text-sm"
              />
            </div>
          </div>

          {/* Folder Tree Scrollable Container */}
          <div className="flex-1 overflow-y-auto px-6 py-2 min-h-[200px] scrollbar-thin">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-12 text-neutral-400">
                <Loader2 className="animate-spin mb-2" size={28} />
                <span className="text-xs font-bold">Loading folders...</span>
              </div>
            ) : error ? (
              <div className="flex items-center space-x-2 py-8 text-destructive text-sm font-bold justify-center">
                <span>Failed to load folders.</span>
              </div>
            ) : (
              <div className="space-y-1 pb-4">
                {/* Root Drive Node */}
                {renderTreeNode(folderTree, 0)}
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="p-6 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between shrink-0 bg-neutral-50/50 dark:bg-neutral-900/10">
            <span className="text-xs font-bold text-neutral-400 truncate max-w-[150px] sm:max-w-[180px]">
              To: <span className="text-neutral-700 dark:text-neutral-200 font-black">{selectedPath === "/" ? "My Drive" : selectedPath}</span>
            </span>
            <div className="flex space-x-2 shrink-0">
              <Button 
                variant="ghost" 
                className="rounded-xl h-11 px-4 font-bold text-neutral-500 text-xs"
                onClick={onClose}
              >
                Cancel
              </Button>
              <Button 
                variant="default" 
                disabled={isInvalidDestination(selectedPath)}
                className="rounded-xl h-11 px-6 font-bold shadow-lg shadow-primary/20 text-xs"
                onClick={() => setShowConfirm(true)}
              >
                Move Here
              </Button>
            </div>
          </div>
        </>
      ) : (
        /* Confirmation Screen */
        <div className="p-8 space-y-6 text-center animate-in fade-in duration-200">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto text-primary">
            <HelpCircle size={32} />
          </div>
          
          <div className="space-y-2">
            <h3 className="text-lg font-black tracking-tight">Confirm Move</h3>
            <p className="text-sm text-neutral-500 font-medium leading-relaxed px-4">
              {getConfirmationMessage()}
            </p>
          </div>

          <div className="flex items-center justify-center space-x-3 pt-2">
            <Button 
              variant="ghost" 
              className="rounded-xl h-12 px-6 font-bold text-neutral-500 text-xs"
              onClick={() => setShowConfirm(false)}
              disabled={isMoving}
            >
              Back
            </Button>
            <Button 
              variant="default" 
              className="rounded-xl h-12 px-8 font-bold shadow-lg shadow-primary/15 text-xs"
              onClick={handleMove}
              disabled={isMoving}
            >
              {isMoving ? (
                <span className="flex items-center space-x-2">
                  <Loader2 size={16} className="animate-spin" />
                  <span>Moving...</span>
                </span>
              ) : (
                "Confirm Move"
              )}
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
