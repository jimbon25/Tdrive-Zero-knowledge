"use client";

import React from "react";
import { createPortal } from "react-dom";
import { FileItem as FileType } from "@/types";
import { 
  X, 
  Download, 
  Trash, 
  ZoomIn, 
  ZoomOut, 
  Copy,
  Check,
  Loader2,
  AlertCircle,
  FileText,
  File,
  Star
} from "lucide-react";
import { Button, cn } from "@/components/ui";
import { api } from "@/lib/axios";
import { useStarFile } from "@/hooks/api/useFiles";
import toast from "react-hot-toast";

interface PreviewModalProps {
  file: FileType;
  isOpen: boolean;
  onClose: () => void;
  onDownload: () => void;
  onDelete: () => void;
}

export function PreviewModal({ file, isOpen, onClose, onDownload, onDelete }: PreviewModalProps) {
  const [zoom, setZoom] = React.useState(100);
  const [isLoading, setIsLoading] = React.useState(true);
  const [textContent, setTextContent] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [isCopied, setIsCopied] = React.useState(false);
  const isCopiedRef = React.useRef(false);
  
  // Cleanup copied state on unmount
  React.useEffect(() => {
    return () => {
      isCopiedRef.current = true; // Prevent further state updates if unmounted
    };
  }, []);
  const [ticket, setTicket] = React.useState<string | null>(null);
  const [mounted, setMounted] = React.useState(false);
  const starMutation = useStarFile();

  const fileExt = file.filename.split(".").pop()?.toLowerCase() || "";
  const isImage = ["jpg", "jpeg", "png", "gif", "webp", "bmp", "heic", "heif"].includes(fileExt);
  const isPDF = fileExt === "pdf";
  const isText = ["txt", "md", "json", "yaml", "yml", "log", "csv"].includes(fileExt);

  const previewUrl = ticket ? `${api.defaults.baseURL}/view/${ticket}` : null;

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (isOpen) {
      import('@/lib/scrollLock').then(({ lockScroll }) => lockScroll());
      
      const controller = new AbortController();
      setTicket(null);
      setError(null);
      setIsLoading(true);
      handleAcquireTicket(controller.signal);

      const handleEsc = (e: KeyboardEvent) => {
        if (e.key === "Escape") onClose();
      };
      window.addEventListener("keydown", handleEsc);

      return () => {
        import('@/lib/scrollLock').then(({ unlockScroll }) => unlockScroll());
        window.removeEventListener("keydown", handleEsc);
        controller.abort();
      };
    }
  }, [isOpen, file.file_id]);

  const handleAcquireTicket = async (signal?: AbortSignal) => {
    try {
      const response = await api.post(`/files/${file.file_id}/ticket`, undefined, { signal });
      const { ticket: newTicket } = response.data.data;
      setTicket(newTicket);

      if (isText) {
        const textResponse = await api.get(`/view/${newTicket}`, { responseType: 'text', signal });
        setTextContent(textResponse.data);
      }
    } catch (err: any) {
      if (err.name === 'CanceledError') return;
      setError("Failed to generate preview. The file might be too large or unavailable.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    if (textContent) {
      if (isCopiedRef.current) return;
    isCopiedRef.current = true;
    navigator.clipboard.writeText(textContent);
    setIsCopied(true);
    setTimeout(() => {
      isCopiedRef.current = false;
      setIsCopied(false);
    }, 2000);
      toast.success("Copied to clipboard");
    }
  };

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[900] flex flex-col bg-neutral-950/95 backdrop-blur-md animate-in fade-in duration-200 overflow-hidden">
      {/* 1. Top Bar */}
      <header className="h-16 flex items-center justify-between px-4 md:px-6 border-b border-white/10 z-20 shrink-0 text-white">
        <div className="flex items-center space-x-4 min-w-0 pr-8">
          <button 
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-full text-white/70 hover:text-white transition-colors"
          >
            <X size={24} />
          </button>
          <div className="min-w-0">
            <h2 className="text-sm md:text-base font-bold text-white truncate tracking-tight">{file.filename}</h2>
            <p className="text-[10px] text-white/40 font-black uppercase tracking-widest">
              {isImage ? "Image" : isPDF ? "Document" : isText ? "Text File" : "Preview"}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-1 md:space-x-2">
          {isImage && (
            <div className="hidden md:flex items-center bg-white/5 rounded-xl p-1 mr-2">
              <button onClick={() => setZoom(z => Math.max(10, z - 20))} className="p-2 hover:bg-white/10 rounded-lg text-white/60"><ZoomOut size={18} /></button>
              <span className="text-[10px] font-black text-white/40 w-12 text-center">{zoom}%</span>
              <button onClick={() => setZoom(z => Math.min(500, z + 20))} className="p-2 hover:bg-white/10 rounded-lg text-white/60"><ZoomIn size={18} /></button>
            </div>
          )}
          
          {isText && textContent && (
            <Button variant="ghost" className="h-10 text-white/60 hover:text-white hover:bg-white/10 rounded-xl" onClick={handleCopy}>
              {isCopied ? <Check size={18} className="text-green-500" /> : <Copy size={18} />}
              <span className="ml-2 hidden sm:inline">Copy</span>
            </Button>
          )}

          <Button 
            variant="ghost" 
            className={cn("h-10 rounded-xl transition-all", file.is_starred ? "text-amber-500 bg-amber-500/10 hover:bg-amber-500/20" : "text-white/60 hover:text-white hover:bg-white/10")} 
            onClick={() => starMutation.mutate({ fileId: file.file_id, starred: !file.is_starred })}
            disabled={starMutation.isPending}
          >
            {starMutation.isPending ? <Loader2 size={18} className="animate-spin" /> : <Star size={18} fill={file.is_starred ? "currentColor" : "none"} />}
            <span className="ml-2 hidden sm:inline">{file.is_starred ? "Starred" : "Star"}</span>
          </Button>

          <Button variant="ghost" className="h-10 text-white/60 hover:text-white hover:bg-white/10 rounded-xl" onClick={onDownload}>
            <Download size={18} />
            <span className="ml-2 hidden sm:inline">Download</span>
          </Button>

          <Button variant="ghost" className="h-10 text-destructive hover:bg-destructive/20 rounded-xl" onClick={onDelete}>
            <Trash size={18} />
          </Button>
        </div>
      </header>

      {/* 2. Main Preview Area */}
      <main className="flex-1 relative flex items-center justify-center overflow-hidden">
        {(isLoading || !previewUrl) && !textContent && !error && (
           <div className="flex flex-col items-center space-y-4">
              <Loader2 className="animate-spin text-primary" size={48} strokeWidth={1.5} />
              <p className="text-white/40 font-bold uppercase tracking-widest text-[10px]">Decrypting Securely...</p>
           </div>
        )}

        {error ? (
          <div className="max-w-md text-center space-y-4 p-8">
             <AlertCircle className="mx-auto text-destructive" size={48} />
             <h3 className="text-xl font-bold text-white">Preview Failed</h3>
             <p className="text-white/60 text-sm leading-relaxed">{error}</p>
             <Button variant="outline" className="border-white/10 text-white hover:bg-white/5 rounded-xl" onClick={onDownload}>
                Download instead
             </Button>
          </div>
        ) : previewUrl ? (
          <div className="w-full h-full flex items-center justify-center p-4 md:p-8">
            {/* --- Image View --- */}
            {isImage && (
               <div 
                 className="transition-transform duration-200 ease-out flex items-center justify-center"
                 style={{ transform: `scale(${zoom / 100})` }}
               >
                 <img 
                   src={previewUrl} 
                   alt={file.filename}
                   onLoad={() => setIsLoading(false)}
                   className={cn("max-w-full max-h-full rounded-lg shadow-2xl transition-opacity duration-300", isLoading ? "opacity-0" : "opacity-100")}
                 />
               </div>
            )}

            {/* --- PDF View --- */}
            {isPDF && (
              <div className="w-full h-full max-w-5xl bg-neutral-900 rounded-2xl overflow-hidden shadow-2xl">
                 <iframe 
                   src={`${previewUrl}#toolbar=0`}
                   className="w-full h-full border-none"
                   onLoad={() => setIsLoading(false)}
                 />
              </div>
            )}

            {/* --- Text View --- */}
            {isText && textContent && (
               <div className="w-full h-full max-w-4xl bg-neutral-900/50 rounded-2xl border border-white/5 overflow-hidden flex flex-col shadow-2xl">
                  <div className="flex items-center px-4 py-2 bg-white/5 border-b border-white/5">
                     <FileText size={14} className="text-primary mr-2" />
                     <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Source Viewer</span>
                  </div>
                  <pre className="flex-1 p-6 overflow-auto font-mono text-sm leading-relaxed text-white/80 selection:bg-primary/30">
                    <code className="block">{textContent}</code>
                  </pre>
               </div>
            )}

            {/* --- Unsupported View --- */}
            {!isImage && !isPDF && !isText && (
               <div className="text-center space-y-6 animate-in zoom-in-95 duration-500">
                  <div className="w-24 h-24 bg-white/5 rounded-[2.5rem] flex items-center justify-center mx-auto text-white/20">
                     <File size={48} strokeWidth={1} />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-bold text-white">No Preview Available</h3>
                    <p className="text-white/40 text-sm max-w-xs mx-auto font-medium">
                      TDrive doesn't support live previews for <span className="text-primary">{fileExt.toUpperCase()}</span> files yet.
                    </p>
                  </div>
                  <Button 
                    className="rounded-2xl h-12 px-8 font-bold shadow-xl shadow-primary/20"
                    onClick={onDownload}
                  >
                    Download File
                  </Button>
               </div>
            )}
          </div>
        ) : null}
      </main>

      {/* 3. Footer / Controls */}
      <footer className="h-16 flex items-center justify-center px-6 z-20 shrink-0">
        <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.4em]">
          End-to-End Encrypted Preview
        </p>
      </footer>
    </div>,
    document.body
  );
}
