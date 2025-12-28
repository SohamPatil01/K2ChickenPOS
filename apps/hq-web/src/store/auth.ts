import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface User {
  id: string;
  name: string;
  phone: string;
  email?: string;
  role: string;
  storeId: string;
  store: {
    id: string;
    name: string;
    type: string;
  };
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  setAuth: (user: User, accessToken: string, refreshToken: string) => void;
  logout: () => void;
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      setAuth: (user, accessToken, refreshToken) => {
        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('refreshToken', refreshToken);
        set({ user, accessToken, refreshToken });
      },
      logout: () => {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        set({ user: null, accessToken: null, refreshToken: null });
      },
      isAuthenticated: () => {
        const state = get();
        const token = localStorage.getItem('accessToken');
        const stored = localStorage.getItem('auth-storage');
        let storedUser = null;
        try {
          if (stored) {
            const parsed = JSON.parse(stored);
            storedUser = parsed.state?.user;
          }
        } catch (e) {
          // Ignore
        }
        
        const hasToken = !!(state.accessToken || token);
        const hasUser = !!(state.user || storedUser);
        return hasToken && hasUser;
      },
    }),
    {
      name: 'hq-auth-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
      }),
    }
  )
);

