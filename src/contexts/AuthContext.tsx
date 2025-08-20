import { createContext } from 'react';

export interface User {
  id: number;
  username: string;
  email: string;
  is_lecturer?: boolean;
  is_dro?: boolean;
  is_fro?: boolean;
  is_co?: boolean;
}

export interface AuthContextType {
  user: User | null;
  login: (userData: User) => void;
  logout: () => void;
  isLoading: boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);