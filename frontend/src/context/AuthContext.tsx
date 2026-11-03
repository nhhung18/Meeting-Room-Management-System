import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { INITIAL_USERS } from '../api/mockData';
import { setTokenProvider, TokenProvider } from '../api/http';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  loginWithAuth0: (role?: UserRole) => void;
  logout: () => void;
  switchRole: (role: UserRole) => void;
  hasRole: (roles: UserRole[]) => boolean;
  updateProfile: (data: Partial<User>) => void;
  getToken: () => Promise<string | null>;
}

/**
 * Creates the token provider function for http.ts.
 * In mock mode returns null (no real JWT).
 * When Auth0 is wired (task #11), replace body with auth0GetTokenSilently().
 */
export function createTokenProvider(): TokenProvider {
  return async (_opts?: { force?: boolean }) => null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_STORAGE_KEY = 'mrms_current_user_v1';

const cleanUserName = (name: string): string => {
  return name.replace(/\s*\((Admin|Manager|Nhân viên|Administrator)\)/gi, '').trim();
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Default: Auto-login as Administrator for dev mode as per requirement
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
    // Default admin user
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

  const logout = () => {
    setUser(null);
  };

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
      const updated = {
        ...prev,
        ...data,
        name: data.name ? cleanUserName(data.name) : prev.name,
      };
      return updated;
    });
  };

  const getToken = async (): Promise<string | null> => null;

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        loginWithAuth0,
        logout,
        switchRole,
        hasRole,
        updateProfile,
        getToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
