"use client";

import React from "react";
import { AlertTriangle, ExternalLink } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui";

export interface DuplicateInfo {
  file: File;
  existingFile: {
    file_id: string;
    filename: string;
    virtual_path: string;
  };
  vpath?: string; // Optional for UploadButton compatibility
}

interface DuplicateWarningDialogProps {
  duplicateInfo: DuplicateInfo | null;
  onOpenExisting: () => void;
  onUploadAnyway: () => void;
  onCancel: () => void;
  formatSize: (bytes: number) => string;
}

export function DuplicateWarningDialog({
  duplicateInfo,
  onOpenExisting,
  onUploadAnyway,
  onCancel,
  formatSize,
}: DuplicateWarningDialogProps) {
  return (
    <Dialog isOpen={!!duplicateInfo} onClose={onCancel}>
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
              <span className="font-bold text-neutral-850 dark:text-neutral-200 break-all">{duplicateInfo?.existingFile.filename}</span>
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
            onClick={onOpenExisting}
          >
            <span>Open Existing File</span>
            <ExternalLink size={16} />
          </Button>
          
          <Button
            variant="outline"
            className="w-full rounded-xl font-bold h-11 border-neutral-200 dark:border-neutral-800"
            onClick={onUploadAnyway}
          >
            Upload Anyway
          </Button>

          <Button
            variant="ghost"
            className="w-full rounded-xl font-bold h-11 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            onClick={onCancel}
          >
            Cancel
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
