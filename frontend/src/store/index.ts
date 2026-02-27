import { create } from 'zustand';
import type { Organization, Inventory, InventorySummary } from '../types';

export interface AppUser {
  id: string;
  email: string;
  full_name: string;
  role: string;
  must_change_password?: boolean;
  organization_id?: string | null;
}

interface AppState {
  // Auth
  token: string | null;
  isAuthenticated: boolean;
  user: AppUser | null;
  setToken: (token: string | null) => void;
  setUser: (user: AppUser | null) => void;
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

let parsedUser: AppUser | null = null;
try {
  const savedUser = localStorage.getItem('user');
  if (savedUser) parsedUser = JSON.parse(savedUser);
} catch { /* ignore corrupted data */ }

export const useStore = create<AppState>((set) => ({
  // Auth
  token: localStorage.getItem('token'),
  isAuthenticated: !!localStorage.getItem('token'),
  user: parsedUser,
  setToken: (token) => {
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }
    set({ token, isAuthenticated: !!token });
  },
  setUser: (user) => {
    if (user) {
      localStorage.setItem('user', JSON.stringify(user));
    } else {
      localStorage.removeItem('user');
    }
    set({ user });
  },
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    set({
      token: null, isAuthenticated: false, user: null,
      currentOrg: null, currentInventory: null, summary: null,
    });
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
