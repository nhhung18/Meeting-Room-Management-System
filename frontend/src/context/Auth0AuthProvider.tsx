import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Auth0Provider, useAuth0, GetTokenSilentlyOptions } from '@auth0/auth0-react';
import { User, UserRole } from '../types';
import { setTokenProvider, TokenProvider } from '../api/http';
import { AuthContext } from './authContextDef';
import { mapAuth0Role } from './roleMapper';

type GetTokenFn = (opts?: GetTokenSilentlyOptions) => Promise<string | undefined>;

const AUTH_ERRORS_REQUIRING_LOGIN = new Set([
  'login_required',
  'consent_required',
  'interaction_required',
  'missing_refresh_token',
]);

export function createAuth0TokenProvider(
  getToken: GetTokenFn,
  onLoginRequired?: () => void,
): TokenProvider {
  return async (opts?: { force?: boolean }) => {
    try {
      const token = await getToken(
        opts?.force ? { cacheMode: 'off' } : undefined,
      );
      return token ?? null;
    } catch (err: unknown) {
      const code = (err as { error?: string })?.error;
      if (code && AUTH_ERRORS_REQUIRING_LOGIN.has(code)) {
        onLoginRequired?.();
      }
      return null;
    }
  };
}

const ROLES_CLAIM = 'https://mrms.api/roles';

const Auth0Inner: React.FC<{ audience: string; children: React.ReactNode }> = ({
  audience,
  children,
}) => {
  const {
    user: auth0User,
    isAuthenticated,
    isLoading: auth0Loading,
    error: auth0Error,
    getAccessTokenSilently,
    loginWithRedirect,
    logout: auth0Logout,
  } = useAuth0();
  const [profileOverride, setProfileOverride] = useState<Partial<User> | null>(null);

  useEffect(() => {
    if (auth0Error) {
      console.error('[Auth0] Error:', auth0Error.message, auth0Error);
    }
  }, [auth0Error]);

  const appUser = useMemo<User | null>(() => {
    if (!isAuthenticated || !auth0User) return null;
    const roles: string[] = auth0User[ROLES_CLAIM] ?? [];
    const base: User = {
      id: auth0User.sub ?? '',
      name: auth0User.name ?? '',
      email: auth0User.email ?? '',
      role: mapAuth0Role(roles),
      department: '',
      avatar: auth0User.picture ?? '',
    };
    return profileOverride ? { ...base, ...profileOverride } : base;
  }, [isAuthenticated, auth0User, profileOverride]);

  useEffect(() => {
    if (isAuthenticated) {
      const onLoginRequired = () =>
        loginWithRedirect({ authorizationParams: { audience } });
      setTokenProvider(createAuth0TokenProvider(getAccessTokenSilently, onLoginRequired));
    } else {
      setTokenProvider(null);
    }
    return () => setTokenProvider(null);
  }, [isAuthenticated, getAccessTokenSilently, loginWithRedirect, audience]);

  const loginWithRedirectWrapped = async (opts?: { appState?: { returnTo?: string } }) => {
    await loginWithRedirect({
      appState: opts?.appState,
      authorizationParams: { audience },
    });
  };

  const logout = () => {
    setProfileOverride(null);
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
    setProfileOverride((prev) => ({ ...(prev || {}), ...data }));
  };

  const getToken = async (): Promise<string | null> => {
    try {
      const token = await getAccessTokenSilently();
      return token ?? null;
    } catch {
      return null;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user: appUser,
        isAuthenticated: !!appUser,
        isLoading: auth0Loading,
        error: auth0Error ?? null,
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
  const navigate = useNavigate();

  return (
    <Auth0Provider
      domain={domain}
      clientId={clientId}
      authorizationParams={{
        redirect_uri: window.location.origin + '/callback',
        audience,
        scope: 'openid profile email offline_access',
      }}
      cacheLocation="localstorage"
      useRefreshTokens={true}
      onRedirectCallback={(appState) => {
        window.history.replaceState(
          {},
          document.title,
          appState?.returnTo ?? window.location.pathname
        );
        navigate(appState?.returnTo ?? '/dashboard', { replace: true });
      }}
    >
      <Auth0Inner audience={audience}>{children}</Auth0Inner>
    </Auth0Provider>
  );
};
