import { create } from 'zustand';
import type { Organization, Inventory, InventorySummary } from '../types';

interface AppState {
  // Auth
  token: string | null;
  isAuthenticated: boolean;
  setToken: (token: string | null) => void;
  logout: () => void;

  // Organization
  currentOrg: Organization | null;
  setCurrentOrg: (org: Organization | null) => void;

  // Inventory
  currentInventory: Inventory | null;
  setCurrentInventory: (inv: Inventory | null) => void;

  // Summary
  summary: InventorySummary | null;
  setSummary: (summary: InventorySummary | null) => void;

  // UI
  sidebarOpen: boolean;
  toggleSidebar: () => void;
}

export const useStore = create<AppState>((set) => ({
  // Auth
  token: localStorage.getItem('token'),
  isAuthenticated: !!localStorage.getItem('token'),
  setToken: (token) => {
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }
    set({ token, isAuthenticated: !!token });
  },
  logout: () => {
    localStorage.removeItem('token');
    set({ token: null, isAuthenticated: false, currentOrg: null, currentInventory: null, summary: null });
  },

  // Organization
  currentOrg: null,
  setCurrentOrg: (org) => set({ currentOrg: org }),

  // Inventory
  currentInventory: null,
  setCurrentInventory: (inv) => set({ currentInventory: inv }),

  // Summary
  summary: null,
  setSummary: (summary) => set({ summary }),

  // UI
  sidebarOpen: true,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
}));
