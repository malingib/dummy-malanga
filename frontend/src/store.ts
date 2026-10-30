import { create } from 'zustand'

type Store = {
  sidebarOpen: boolean
  sidebarCollapsed: boolean
  toggleSidebar: () => void
  toggleCollapsed: () => void
  closeSidebar: () => void
}

export const useUiStore = create<Store>((set) => ({
  sidebarOpen: false,
  sidebarCollapsed: false,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  toggleCollapsed: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  closeSidebar: () => set({ sidebarOpen: false }),
}))
