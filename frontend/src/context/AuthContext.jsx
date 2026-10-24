import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('rps_token'));
  const [loading, setLoading] = useState(true);

  // Load user profile on token change
  useEffect(() => {
    if (token) {
      localStorage.setItem('rps_token', token);
      fetchProfile(token);
    } else {
      localStorage.removeItem('rps_token');
      setUser(null);
      setLoading(false);
    }
  }, [token]);

  const fetchProfile = async (authToken) => {
    try {
      const res = await fetch('/api/auth/me', {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.data);
      } else {
        logout();
      }
    } catch (err) {
      console.warn('[Auth] Cannot connect to auth server:', err);
    } finally {
      setLoading(false);
    }
  };

  const login = async (username, password) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Đăng nhập thất bại.');
    }
    setToken(data.data.token);
    setUser(data.data.user);
    return data.data;
  };

  const register = async (username, password, role = 'STUDENT') => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, role }),
    });
    const data = await res.json();
    if (!res.ok) {
      const errMsg = Array.isArray(data.errors) ? data.errors.join(', ') : data.message;
      throw new Error(errMsg || 'Đăng ký thất bại.');
    }
    setToken(data.data.token);
    setUser(data.data.user);
    return data.data;
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('rps_token');
  };

  const getAuthHeaders = () => {
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        register,
        logout,
        refreshProfile: () => fetchProfile(token),
        getAuthHeaders,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
