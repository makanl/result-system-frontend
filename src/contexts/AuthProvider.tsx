import { useState, useEffect, type ReactNode } from 'react';
import { AuthContext, type User } from './AuthContext';
import api from '../services/api';

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  });
  const [isLoading, setIsLoading] = useState(true);

  const login = (userData: any) => {
    // Default role fields to false if not present
    const mappedUser: User = {
      ...userData,
      is_lecturer: userData.is_lecturer ?? false,
      is_dro: userData.is_dro ?? false,
      is_fro: userData.is_fro ?? false,
      is_co: userData.is_co ?? false,
    };
    setUser(mappedUser);
    localStorage.setItem('user', JSON.stringify(mappedUser));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('user');
    localStorage.removeItem('access');
    localStorage.removeItem('refresh');
  };

  const verifyToken = async () => {
    const token = localStorage.getItem('access');
    const storedUser = localStorage.getItem('user');
    if (token && storedUser) {
      try {
        const response = await api.get('/auth/users/me/');
        const userData = response.data;
        // Default role fields to false if not present
        const mappedUser: User = {
          ...userData,
          is_lecturer: userData.is_lecturer ?? false,
          is_dro: userData.is_dro ?? false,
          is_fro: userData.is_fro ?? false,
          is_co: userData.is_co ?? false,
        };
        setUser(mappedUser);
        localStorage.setItem('user', JSON.stringify(mappedUser));
        return true;
      } catch (error) {
        console.error('Token verification failed:', error);
        logout();
        return false;
      }
    }
    return false;
  };

  // Initial token verification on mount
  useEffect(() => {
    const initAuth = async () => {
      await verifyToken();
      setIsLoading(false);
    };
    initAuth();
  }, []);

  // Handle browser navigation (back/forward buttons)
  useEffect(() => {
    const handlePopState = async () => {
      if (!user) {
        const isAuthenticated = await verifyToken();
        if (!isAuthenticated) {
          // If not authenticated, ensure we're not on the login page
          if (window.location.pathname !== '/login') {
            window.location.href = '/login';
          }
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [user]);

  useEffect(() => {
    if (user) {
      localStorage.setItem('user', JSON.stringify(user));
    }
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};