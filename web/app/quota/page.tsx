"use client";

import React, { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import toast from "react-hot-toast";

function QuotaRedirectHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();

  React.useEffect(() => {
    const providers = ["google", "onedrive", "dropbox", "yandex"];
    let redirected = false;

    for (const provider of providers) {
      const status = searchParams.get(provider);
      if (status) {
        const providerName = provider === "google" ? "Google Drive" 
                           : provider === "onedrive" ? "OneDrive" 
                           : provider === "dropbox" ? "Dropbox" 
                           : provider === "yandex" ? "Yandex" 
                           : provider;

        if (status === "connected") {
          toast.success(`${providerName} linked successfully!`);
        } else if (status === "error") {
          const message = searchParams.get("message") || "Unknown error occurred";
          toast.error(`Failed to link ${providerName}: ${message}`);
        }
        
        router.replace("/settings");
        redirected = true;
        break;
      }
    }

    if (!redirected) {
      router.replace("/settings");
    }
  }, [router, searchParams]);

  return (
    <div className="flex flex-col items-center space-y-4">
      <Loader2 className="animate-spin text-primary" size={32} />
      <p className="text-sm font-semibold tracking-tight text-neutral-500">
        Finalizing account connection...
      </p>
    </div>
  );
}

export default function QuotaRedirectPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground">
      <Suspense fallback={
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="animate-spin text-primary" size={32} />
          <p className="text-sm font-semibold tracking-tight text-neutral-500">
            Loading...
          </p>
        </div>
      }>
        <QuotaRedirectHandler />
      </Suspense>
    </div>
  );
}
