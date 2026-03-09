import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { authService } from '../services/api';
import type { User } from '../types';

interface AuthStore {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { username: string; email: string; password: string; display_name: string }) => Promise<void>;
  logout: () => Promise<void>;
  loadUser: () => Promise<void>;
  updateUser: (user: Partial<User>) => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const res = await authService.login(email, password);
      const raw = res.user ?? res;
      const user: User = {
        ...raw,
        displayName: raw.display_name ?? raw.displayName ?? raw.username ?? '',
      };
      set({ user, isAuthenticated: true, isLoading: false });
    } catch (e: any) {
      set({ error: e.message ?? 'Erro ao entrar', isLoading: false });
      throw e;
    }
  },

  register: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const res = await authService.register(data);
      const raw = res.user ?? res;
      const user: User = {
        ...raw,
        displayName: raw.display_name ?? raw.displayName ?? raw.username ?? '',
      };
      set({ user, isAuthenticated: true, isLoading: false });
    } catch (e: any) {
      set({ error: e.message ?? 'Erro ao criar conta', isLoading: false });
      throw e;
    }
  },

  logout: async () => {
    await authService.logout();
    set({ user: null, isAuthenticated: false });
  },

  loadUser: async () => {
    try {
      const token = await SecureStore.getItemAsync('backlog_network_token');
      if (!token) { set({ isLoading: false }); return; }
      const raw = await authService.me();
      const user: User = {
        ...raw,
        displayName: raw.display_name ?? raw.displayName ?? raw.username ?? '',
      };
      set({ user, isAuthenticated: true, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  updateUser: (partial) =>
    set((state) => ({ user: state.user ? { ...state.user, ...partial } : null })),

  clearError: () => set({ error: null }),
}));
