import { createContext } from 'react';
import { User, UserRole } from '../types';
import { TokenProvider } from '../api/http';

export interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error?: Error | null;
  loginWithAuth0: (role?: UserRole) => void;
  loginWithRedirect?: (opts?: { appState?: { returnTo?: string } }) => Promise<void>;
  logout: () => void;
  switchRole: (role: UserRole) => void;
  hasRole: (roles: UserRole[]) => boolean;
  updateProfile: (data: Partial<User>) => void;
  getToken: () => Promise<string | null>;
}

export function isAuth0Mode(domain?: string, clientId?: string, audience?: string): boolean {
  return Boolean(domain && clientId && audience);
}

export function createTokenProvider(): TokenProvider {
  return async (_opts?: { force?: boolean }) => null;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);
