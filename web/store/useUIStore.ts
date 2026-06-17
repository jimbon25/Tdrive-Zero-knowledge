import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemeMode = "light" | "dark" | "system";
export type AccentColor = "blue" | "green" | "purple";
export type UIDensity = "comfortable" | "compact";

interface UIState {
  // Navigation
  isDesktopSidebarOpen: boolean;
  isMobileMenuOpen: boolean;
  
  // Preferences (Persisted)
  themeMode: ThemeMode;
  accentColor: AccentColor;
  density: UIDensity;
  viewMode: "grid" | "list";
  
  // Search
  searchQuery: string;

  // Security
  isServerUnlocked: boolean;
  
  // Jobs
  activeUploads: string[]; // Job IDs
  
  // Actions
  setDesktopSidebarOpen: (open: boolean) => void;
  toggleDesktopSidebar: () => void;
  setMobileMenuOpen: (open: boolean) => void;
  toggleMobileMenu: () => void;
  setThemeMode: (mode: ThemeMode) => void;
  setAccentColor: (color: AccentColor) => void;
  setDensity: (density: UIDensity) => void;
  setViewMode: (mode: "grid" | "list") => void;
  setSearchQuery: (query: string) => void;
  setServerUnlocked: (unlocked: boolean) => void;
  addActiveUpload: (jobId: string) => void;
  removeActiveUpload: (jobId: string) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      isDesktopSidebarOpen: true,
      isMobileMenuOpen: false,
      
      themeMode: "system",
      accentColor: "blue",
      density: "comfortable",
      viewMode: "list",
      
      searchQuery: "",
      isServerUnlocked: false,
      activeUploads: [],
      
      setDesktopSidebarOpen: (open) => set({ isDesktopSidebarOpen: open }),
      toggleDesktopSidebar: () => set((state) => ({ isDesktopSidebarOpen: !state.isDesktopSidebarOpen })),
      
      setMobileMenuOpen: (open) => set({ isMobileMenuOpen: open }),
      toggleMobileMenu: () => set((state) => ({ isMobileMenuOpen: !state.isMobileMenuOpen })),
      
      setThemeMode: (themeMode) => set({ themeMode }),
      setAccentColor: (accentColor) => set({ accentColor }),
      setDensity: (density) => set({ density }),
      setViewMode: (mode) => set({ viewMode: mode }),
      setSearchQuery: (query) => set({ searchQuery: query }),
      setServerUnlocked: (unlocked) => set({ isServerUnlocked: unlocked }),
      
      addActiveUpload: (jobId) =>
        set((state) => ({
          activeUploads: state.activeUploads.includes(jobId)
            ? state.activeUploads
            : [...state.activeUploads, jobId],
        })),
      removeActiveUpload: (jobId) =>
        set((state) => ({
          activeUploads: state.activeUploads.filter((id) => id !== jobId),
        })),
    }),
    {
      name: "tdrive-ui-storage",
      partialize: (state) => ({ 
        themeMode: state.themeMode, 
        accentColor: state.accentColor, 
        density: state.density,
        viewMode: state.viewMode
      }),
    }
  )
);
