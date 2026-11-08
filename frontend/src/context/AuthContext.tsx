import React, { useContext, useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { INITIAL_USERS } from '../api/mockData';
import { setTokenProvider } from '../api/http';
import {
  AuthContext,
  AuthContextType,
  createTokenProvider,
  isAuth0Mode,
} from './authContextDef';
import { Auth0AuthProvider } from './Auth0AuthProvider';

export type { AuthContextType };
export { AuthContext, createTokenProvider, isAuth0Mode };

const AUTH_STORAGE_KEY = 'mrms_current_user_v1';

const cleanUserName = (name: string): string => {
  return name.replace(/\s*\((Admin|Manager|Nhân viên|Administrator)\)/gi, '').trim();
};

const MockAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const stored = localStorage.getItem(AUTH_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.name) parsed.name = cleanUserName(parsed.name);
        return parsed;
      }
    } catch (e) {
      console.error(e);
    }
    const defaultUser = { ...INITIAL_USERS[0], name: cleanUserName(INITIAL_USERS[0].name) };
    return defaultUser;
  });

  useEffect(() => {
    if (user) {
      const sanitized = { ...user, name: cleanUserName(user.name) };
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(sanitized));
    } else {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    }
  }, [user]);

  useEffect(() => {
    const provider = createTokenProvider();
    setTokenProvider(provider);
    return () => setTokenProvider(null);
  }, []);

  const loginWithAuth0 = (role: UserRole = 'ADMINISTRATOR') => {
    const matched = INITIAL_USERS.find((u) => u.role === role) || INITIAL_USERS[0];
    setUser({ ...matched, name: cleanUserName(matched.name) });
  };

  const logout = () => setUser(null);

  const switchRole = (role: UserRole) => {
    const matched = INITIAL_USERS.find((u) => u.role === role);
    if (matched) {
      setUser(matched);
    } else if (user) {
      setUser({ ...user, role });
    }
  };

  const hasRole = (roles: UserRole[]): boolean => {
    if (!user) return false;
    return roles.includes(user.role);
  };

  const updateProfile = (data: Partial<User>) => {
    setUser((prev) => {
      if (!prev) return null;
      return { ...prev, ...data, name: data.name ? cleanUserName(data.name) : prev.name };
    });
  };

  const getToken = async (): Promise<string | null> => null;

  return (
    <AuthContext.Provider
      value={{ user, isAuthenticated: !!user, loginWithAuth0, logout, switchRole, hasRole, updateProfile, getToken }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const domain = import.meta.env.VITE_AUTH0_DOMAIN as string | undefined;
  const clientId = import.meta.env.VITE_AUTH0_CLIENT_ID as string | undefined;
  const audience = import.meta.env.VITE_AUTH0_AUDIENCE as string | undefined;

  if (isAuth0Mode(domain, clientId, audience)) {
    return (
      <Auth0AuthProvider domain={domain!} clientId={clientId!} audience={audience!}>
        {children}
      </Auth0AuthProvider>
    );
  }

  return <MockAuthProvider>{children}</MockAuthProvider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
