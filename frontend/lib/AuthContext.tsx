// lib/AuthContext.tsx - Fixed version
'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from "next/navigation";
import { authService } from '@/services/api/auth';

interface User {
  id: number;
  email: string;
  first_name: string;
  surname: string;
  user_type: string;
  organization_id: number;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  isLoading: boolean;
  checkAuthStatus: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // Load user from localStorage on initial render
  useEffect(() => {
    const savedUser = localStorage.getItem('auth_user');
    if (savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser);
        setUser(parsedUser);
      } catch (error) {
        localStorage.removeItem('auth_user');
      }
    }
    checkAuthStatus();
  }, []);

  // Save user to localStorage whenever it changes
  useEffect(() => {
    if (user) {
      localStorage.setItem('auth_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('auth_user');
    }
  }, [user]);

  const checkAuthStatus = async () => {
    setIsLoading(true);
    try {
      const response = await authService.getCurrentUser();
      console.log('checkAuthStatus response:', response);
      
      if (response.success && response.user) {
        setUser(response.user);
        return; // Successfully authenticated
      } else {
        setUser(null);
        localStorage.removeItem('auth_user');
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      setUser(null);
      localStorage.removeItem('auth_user');
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      const response = await authService.login({ email, password });
      console.log('Login API response:', response);
      
      if (response.success) {
        // Fetch the user data immediately after successful login
        const userResponse = await authService.getCurrentUser();
        console.log('User data after login:', userResponse);
        
        if (userResponse.success && userResponse.user) {
          setUser(userResponse.user);
          setIsLoading(false);
          return true;
        } else {
          console.error('Failed to fetch user data after login');
          setIsLoading(false);
          return false;
        }
      }
      setIsLoading(false);
      return false;
    } catch (error: any) {
      console.error('Login failed:', error);
      setIsLoading(false);
      return false;
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await authService.logout();
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      setUser(null);
      localStorage.removeItem('auth_user');
      router.push('/login');
    }
  };

  const value = {
    user,
    login,
    logout,
    isLoading,
    checkAuthStatus,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};