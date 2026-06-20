"use client";

import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { api } from "@/lib/axios";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { 
  Lock, 
  ShieldCheck, 
  KeyRound, 
  Loader2, 
  Globe, 
  ArrowRight,
  ChevronRight
} from "lucide-react";
import { 
  Button, 
  Input, 
  Form, 
  FormControl, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from "@/components/ui";

const loginSchema = z.object({
  password: z.string().min(1, "Master Password is required"),
});

export default function LoginPage() {
  const router = useRouter();
  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { password: "" },
  });

  const onSubmit = async (values: z.infer<typeof loginSchema>) => {
    try {
      const response = await api.post("/auth/login", values);
      const { access_token, csrf_token } = response.data.data;

      localStorage.setItem("tdrive_session_token", access_token);
      localStorage.setItem("tdrive_csrf_token", csrf_token);

      toast.success("Identity Verified");
      router.push("/files");
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || "Verification Failed");
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col md:flex-row bg-background">
      {/* 1. Left Branding Panel (Desktop Only) */}
      <div className="hidden lg:flex flex-col justify-between w-[45%] bg-neutral-950 p-12 text-white relative overflow-hidden">
        {/* Animated Background Orbs */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-[-10%] right-[-20%] w-[800px] h-[800px] bg-primary/40 rounded-full blur-[120px] animate-pulse duration-[8000ms]" />
          <div className="absolute bottom-[-10%] left-[-20%] w-[600px] h-[600px] bg-indigo-600/40 rounded-full blur-[100px] animate-pulse duration-[10000ms] delay-1000" />
        </div>

        {/* Logo */}
        <div className="relative z-10 flex items-center space-x-3 animate-in fade-in slide-in-from-left-8 duration-700">
          <div className="relative w-12 h-12 rounded-[14px] bg-gradient-to-br from-primary via-primary to-indigo-600 flex items-center justify-center shadow-xl shadow-primary/30 border border-white/20 overflow-hidden group-hover:scale-105 transition-transform">
            <div className="absolute top-0 right-0 w-6 h-6 bg-white/30 blur-[6px] rounded-full translate-x-2 -translate-y-2" />
            <span className="relative text-white font-black text-xl tracking-tighter drop-shadow-lg">T</span>
          </div>
          <span className="text-3xl font-black tracking-tighter text-white">TDrive</span>
        </div>

        <div className="relative z-10 space-y-6">
          <h1 className="text-5xl font-bold leading-tight tracking-tighter">
            Your Personal<br />
            <span className="text-primary">Cloud Fortress.</span>
          </h1>
          <p className="text-neutral-400 text-lg max-w-md leading-relaxed">
            Zero-knowledge encrypted storage powered by Telegram's resilient backend. 
            Privacy isn't a feature, it's our core architecture.
          </p>
          
          <div className="flex items-center space-x-8 pt-4">
            <div className="space-y-1">
              <p className="text-2xl font-bold">AES-256</p>
              <p className="text-xs uppercase font-bold text-neutral-500 tracking-widest">Encryption</p>
            </div>
            <div className="w-px h-10 bg-neutral-800" />
            <div className="space-y-1">
              <p className="text-2xl font-bold">UNLIMITED</p>
              <p className="text-xs uppercase font-bold text-neutral-500 tracking-widest">Storage</p>
            </div>
          </div>
        </div>

        <div className="relative z-10 flex items-center space-x-2 text-xs text-neutral-500 font-bold uppercase tracking-widest">
          <ShieldCheck size={14} className="text-primary" />
          <span>Local decryption only</span>
        </div>
      </div>

      {/* 2. Login Form Area */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-12 lg:p-24 relative bg-white dark:bg-neutral-950">
        
        {/* Subtle background glow for right side */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[100px] pointer-events-none animate-pulse duration-[12000ms]" />

        {/* Mobile Logo */}
        <div className="lg:hidden mb-12 flex flex-col items-center space-y-4 animate-in fade-in slide-in-from-top-4 duration-700">
          <div className="relative w-16 h-16 rounded-[20px] bg-gradient-to-br from-primary via-primary to-indigo-600 flex items-center justify-center shadow-2xl shadow-primary/30 border border-primary/20 overflow-hidden">
            <div className="absolute top-0 right-0 w-8 h-8 bg-white/20 blur-[8px] rounded-full translate-x-2 -translate-y-2" />
            <span className="relative text-white font-black text-3xl tracking-tighter drop-shadow-md">T</span>
          </div>
          <h2 className="text-2xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-neutral-900 to-neutral-500 dark:from-white dark:to-neutral-400">
            TDrive Cloud
          </h2>
        </div>

        <div className="w-full max-w-sm space-y-8 animate-in fade-in zoom-in-95 duration-1000 delay-150 fill-mode-both relative z-10">
          <div className="space-y-2 text-center md:text-left">
            <h3 className="text-3xl font-black tracking-tight">Unlock Drive</h3>
            <p className="text-neutral-500 dark:text-neutral-400 text-sm font-medium">
              Enter your Master Password to decrypt your session.
            </p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Master Password</FormLabel>
                    <FormControl>
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-neutral-400 group-focus-within:text-primary transition-colors">
                          <Lock size={18} />
                        </div>
                        <input
                          type="password"
                          placeholder="••••••••••••"
                          className="w-full h-14 bg-white dark:bg-neutral-900/50 border-2 border-neutral-100 dark:border-neutral-800 rounded-2xl pl-12 pr-4 outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all font-mono shadow-sm hover:border-neutral-200 dark:hover:border-neutral-700"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage className="text-xs font-medium" />
                  </FormItem>
                )}
              />

              <Button 
                type="submit" 
                className="w-full h-14 rounded-2xl text-base font-black shadow-xl shadow-primary/20 group overflow-hidden relative transition-all hover:scale-[1.02] active:scale-[0.98]"
                disabled={form.formState.isSubmitting}
              >
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
                {form.formState.isSubmitting ? (
                  <Loader2 className="animate-spin relative z-10" size={20} />
                ) : (
                  <span className="flex items-center justify-center relative z-10">
                    Access Files
                    <ArrowRight size={18} className="ml-2 group-hover:translate-x-1.5 transition-transform" />
                  </span>
                )}
              </Button>
            </form>
          </Form>

          <div className="pt-8 grid grid-cols-1 gap-4">
            <div className="p-4 bg-neutral-50/50 dark:bg-neutral-900/50 rounded-2xl border border-neutral-100 dark:border-neutral-800/50 flex items-center space-x-4 backdrop-blur-sm transition-all hover:bg-neutral-50 dark:hover:bg-neutral-900">
              <div className="p-2.5 bg-white dark:bg-neutral-800 rounded-xl shadow-sm text-neutral-400 border border-neutral-100 dark:border-neutral-700">
                <Globe size={18} className="text-primary" />
              </div>
              <p className="text-xs text-neutral-500 leading-relaxed font-medium">
                Your data is stored on Telegram servers but only <strong>you</strong> hold the keys.
              </p>
            </div>
          </div>
        </div>

        {/* Footer Link */}
        <footer className="mt-12 md:absolute md:bottom-8 text-center text-xs text-neutral-400 font-medium">
          TDrive Personal Agent v1.4.0 • Built for Privacy • Built with DLA
        </footer>
      </div>
    </div>
  );
}
