import React, { useEffect, useState } from 'react';
import { Auth0Provider, useAuth0 } from '@auth0/auth0-react';
import { User, UserRole } from '../types';
import { setTokenProvider, TokenProvider } from '../api/http';
import { AuthContext } from './AuthContext';
import { mapAuth0Role } from './roleMapper';

export function createAuth0TokenProvider(
  getAccessTokenSilently: (opts?: { cacheMode?: string }) => Promise<string>
): TokenProvider {
  return async (opts?: { force?: boolean }) => {
    try {
      return await getAccessTokenSilently({
        cacheMode: opts?.force ? 'off' : 'cache-first',
      });
    } catch {
      return null;
    }
  };
}

const ROLES_CLAIM = 'https://mrms.api/roles';

const Auth0Inner: React.FC<{ audience: string; children: React.ReactNode }> = ({
  audience,
  children,
}) => {
  const { user: auth0User, isAuthenticated, getAccessTokenSilently, loginWithRedirect, logout: auth0Logout } = useAuth0();
  const [appUser, setAppUser] = useState<User | null>(null);

  useEffect(() => {
    if (isAuthenticated && auth0User) {
      const roles: string[] = auth0User[ROLES_CLAIM] ?? [];
      setAppUser({
        id: auth0User.sub ?? '',
        name: auth0User.name ?? '',
        email: auth0User.email ?? '',
        role: mapAuth0Role(roles),
        department: '',
        avatar: auth0User.picture ?? '',
      });
    } else {
      setAppUser(null);
    }
  }, [isAuthenticated, auth0User]);

  useEffect(() => {
    if (isAuthenticated) {
      setTokenProvider(createAuth0TokenProvider(getAccessTokenSilently));
    } else {
      setTokenProvider(null);
    }
    return () => setTokenProvider(null);
  }, [isAuthenticated, getAccessTokenSilently]);

  const loginWithRedirectWrapped = async (opts?: { appState?: { returnTo?: string } }) => {
    await loginWithRedirect({
      appState: opts?.appState,
      authorizationParams: { audience },
    });
  };

  const logout = () => {
    auth0Logout({ logoutParams: { returnTo: window.location.origin + '/login' } });
  };

  const hasRole = (roles: UserRole[]): boolean => {
    if (!appUser) return false;
    return roles.includes(appUser.role);
  };

  const switchRole = (_role: UserRole) => {
    // In Auth0 mode, roles come from the token — switching is a no-op
  };

  const updateProfile = (data: Partial<User>) => {
    setAppUser((prev) => (prev ? { ...prev, ...data } : null));
  };

  const getToken = async (): Promise<string | null> => {
    try {
      return await getAccessTokenSilently({ cacheMode: 'cache-first' } as Parameters<typeof getAccessTokenSilently>[0]);
    } catch {
      return null;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user: appUser,
        isAuthenticated: !!appUser,
        loginWithAuth0: () => {},
        loginWithRedirect: loginWithRedirectWrapped,
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

export const Auth0AuthProvider: React.FC<{
  domain: string;
  clientId: string;
  audience: string;
  children: React.ReactNode;
}> = ({ domain, clientId, audience, children }) => {
  return (
    <Auth0Provider
      domain={domain}
      clientId={clientId}
      authorizationParams={{
        redirect_uri: window.location.origin + '/callback',
        audience,
      }}
      onRedirectCallback={(appState) => {
        window.history.replaceState(
          {},
          document.title,
          appState?.returnTo ?? window.location.pathname
        );
      }}
    >
      <Auth0Inner audience={audience}>{children}</Auth0Inner>
    </Auth0Provider>
  );
};
