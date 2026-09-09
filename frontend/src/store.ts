import { create } from 'zustand'

type Store = {
  sidebarOpen: boolean
  environment: 'sandbox' | 'production'
  toggleSidebar: () => void
  setEnvironment: (environment: Store['environment']) => void
}

export const useUiStore = create<Store>((set) => ({
  sidebarOpen: false,
  environment: 'sandbox',
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setEnvironment: (environment) => set({ environment }),
}))
