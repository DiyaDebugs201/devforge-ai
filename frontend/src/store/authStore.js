import { create } from 'zustand';
import api from '../services/api';

const useAuthStore = create((set, get) => ({
  user: null,
  token: localStorage.getItem('DevForge AI_token'),
  isAuthenticated: !!localStorage.getItem('DevForge AI_token'),
  isLoading: false,
  error: null,

  // Initialize — validate stored token
  initialize: async () => {
    const token = localStorage.getItem('DevForge AI_token');
    if (!token) return;
    try {
      set({ isLoading: true });
      const res = await api.get('/auth/me');
      set({ user: res.data.user, isAuthenticated: true, isLoading: false });
    } catch {
      localStorage.removeItem('DevForge AI_token');
      set({ user: null, token: null, isAuthenticated: false, isLoading: false });
    }
  },

  register: async (name, email, password) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.post('/auth/register', { name, email, password });
      const { token, user } = res.data;
      localStorage.setItem('DevForge AI_token', token);
      set({ user, token, isAuthenticated: true, isLoading: false });
      return { success: true };
    } catch (err) {
      const message = err.response?.data?.message || 'Registration failed';
      set({ error: message, isLoading: false });
      return { success: false, message };
    }
  },

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.post('/auth/login', { email, password });
      const { token, user } = res.data;
      localStorage.setItem('DevForge AI_token', token);
      set({ user, token, isAuthenticated: true, isLoading: false });
      return { success: true };
    } catch (err) {
      const message = err.response?.data?.message || 'Login failed';
      set({ error: message, isLoading: false });
      return { success: false, message };
    }
  },

  logout: () => {
    localStorage.removeItem('DevForge AI_token');
    set({ user: null, token: null, isAuthenticated: false, error: null });
  },

  updateUser: (updates) => {
    set((state) => ({ user: { ...state.user, ...updates } }));
  },

  clearError: () => set({ error: null }),
}));

export default useAuthStore;
