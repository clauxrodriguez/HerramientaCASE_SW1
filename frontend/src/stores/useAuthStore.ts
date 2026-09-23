import { create } from 'zustand';
import { User } from '../types/uml';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isAuthModalOpen: boolean;
  isProfileModalOpen: boolean;
  
  setAuth: (user: User, token: string) => void;
  logout: () => void;
  openAuthModal: () => void;
  closeAuthModal: () => void;
  openProfileModal: () => void;
  closeProfileModal: () => void;
}

const savedUser = localStorage.getItem('auth_user');
const savedToken = localStorage.getItem('auth_token');

export const useAuthStore = create<AuthState>((set) => ({
  user: savedUser ? JSON.parse(savedUser) : null,
  token: savedToken || null,
  isAuthenticated: !!savedUser && !!savedToken,
  isAuthModalOpen: false,
  isProfileModalOpen: false,

  setAuth: (user, token) => {
    localStorage.setItem('auth_user', JSON.stringify(user));
    localStorage.setItem('auth_token', token);
    set({ user, token, isAuthenticated: true, isAuthModalOpen: false });
  },

  logout: () => {
    localStorage.removeItem('auth_user');
    localStorage.removeItem('auth_token');
    set({ user: null, token: null, isAuthenticated: false });
  },

  openAuthModal: () => set({ isAuthModalOpen: true }),
  closeAuthModal: () => set({ isAuthModalOpen: false }),
  openProfileModal: () => set({ isProfileModalOpen: true }),
  closeProfileModal: () => set({ isProfileModalOpen: false }),
}));
