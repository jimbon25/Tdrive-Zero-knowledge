"use client";

import React from "react";
import { useNotificationStore } from "@/store/useNotificationStore";
import { Button, cn, Input } from "@/components/ui";
import { Dialog } from "@/components/ui/Dialog";
import { X, AlertCircle, HelpCircle, Info } from "lucide-react";

export function DialogProvider() {
  const { dialog, closeDialog } = useNotificationStore();
  const [inputValue, setInputValue] = React.useState("");

  React.useEffect(() => {
    if (dialog?.type === "prompt") {
      setInputValue(dialog.defaultValue || "");
    }
  }, [dialog]);

  const handleConfirm = () => {
    if (dialog?.type === "prompt") {
      closeDialog(inputValue);
    } else {
      closeDialog(true);
    }
  };

  const handleCancel = () => {
    if (!dialog) return;
    closeDialog(dialog.type === "prompt" ? null : false);
  };

  const getIcon = () => {
    switch (dialog?.type) {
      case "confirm": return <HelpCircle className="text-primary" size={24} />;
      case "alert": return <AlertCircle className="text-destructive" size={24} />;
      default: return <Info className="text-blue-500" size={24} />;
    }
  };

  return (
    <Dialog 
      isOpen={!!dialog?.isOpen} 
      onClose={handleCancel}
      className="max-h-[90vh]"
    >
      <div className="p-8 space-y-6 overflow-y-auto">
        <div className="flex items-start space-x-4">
          <div className="p-3 bg-neutral-100 dark:bg-neutral-800 rounded-2xl shrink-0">
             {getIcon()}
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-black tracking-tight leading-tight">{dialog?.title}</h3>
            <p className="text-sm text-neutral-500 font-medium leading-relaxed">
              {dialog?.message}
            </p>
          </div>
        </div>

        {dialog?.type === "prompt" && (
          <div className="animate-in slide-in-from-top-2 duration-300">
            <Input 
              autoFocus
              placeholder={dialog.placeholder}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleConfirm()}
              className="h-14 text-base px-6 rounded-2xl border-neutral-200 focus:ring-primary/20"
            />
          </div>
        )}

        <div className="flex items-center justify-end space-x-3 pt-2">
          {dialog?.type !== "alert" && (
            <Button 
              variant="ghost" 
              className="rounded-xl h-12 px-6 font-bold text-neutral-500"
              onClick={handleCancel}
            >
              {dialog?.cancelLabel}
            </Button>
          )}
          <Button 
            variant={dialog?.type === "alert" ? "default" : "primary" as any} 
            className={cn(
              "rounded-xl h-12 px-8 font-bold shadow-lg shadow-primary/10",
              dialog?.type === "confirm" && dialog.title.toLowerCase().includes("delete") && "bg-destructive text-white hover:bg-destructive/90 shadow-destructive/10"
            )}
            onClick={handleConfirm}
          >
            {dialog?.confirmLabel}
          </Button>
        </div>
      </div>

      <button 
        onClick={handleCancel}
        className="absolute top-6 right-6 p-2 text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full transition-colors"
      >
        <X size={20} />
      </button>
    </Dialog>
  );
}
