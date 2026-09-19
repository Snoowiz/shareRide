import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme as useSystemColorScheme } from 'react-native';
import { useAuth } from './AuthContext';

export type ThemeMode = 'light' | 'dark' | 'system';
export type UserRole = 'rider' | 'driver';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatar: string | null;
  rating: number;
  totalRides: number;
  isVerifiedDriver: boolean;
  walletBalance: number;
}

interface AppContextType {
  themeMode: ThemeMode;
  colorScheme: 'light' | 'dark';
  setThemeMode: (mode: ThemeMode) => void;
  userRole: UserRole;
  user: UserProfile;
  setUser: (user: UserProfile) => void;
  currentLocation: { latitude: number, longitude: number } | null;
  setCurrentLocation: (loc: { latitude: number, longitude: number } | null) => void;
  currentAddress: string;
  setCurrentAddress: (addr: string) => void;
  destinationLocation: { latitude: number, longitude: number } | null;
  setDestinationLocation: (loc: { latitude: number, longitude: number } | null) => void;
  destinationAddress: string;
  setDestinationAddress: (addr: string) => void;
}

const emptyUser: UserProfile = {
  id: '',
  name: '',
  email: '',
  phone: '',
  avatar: null,
  rating: 0,
  totalRides: 0,
  isVerifiedDriver: false,
  walletBalance: 0,
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useSystemColorScheme() ?? 'light';
  const { authUser, updateAuthUser, setSelectedRole } = useAuth();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');
  const [user, setUser] = useState<UserProfile>(emptyUser);
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number, longitude: number } | null>(null);
  const [currentAddress, setCurrentAddress] = useState<string>('Fetching location...');
  const [destinationLocation, setDestinationLocation] = useState<{ latitude: number, longitude: number } | null>(null);
  const [destinationAddress, setDestinationAddress] = useState<string>('');

  // Load theme preference on startup
  useEffect(() => {
    import('@react-native-async-storage/async-storage').then(({ default: AsyncStorage }) => {
      AsyncStorage.getItem('@goride_theme_mode').then((mode) => {
        if (mode === 'light' || mode === 'dark' || mode === 'system') {
          setThemeModeState(mode);
        }
      });
    });
  }, []);

  const setThemeMode = async (mode: ThemeMode) => {
    setThemeModeState(mode);
    const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
    await AsyncStorage.setItem('@goride_theme_mode', mode);
  };

  // Sync internal 'user' state with AuthContext's authUser
  useEffect(() => {
    if (authUser) {
      setUser({
        id: authUser.id,
        name: `${authUser.firstName} ${authUser.lastName}`.trim(),
        email: authUser.email,
        phone: authUser.phone,
        avatar: authUser.avatar,
        rating: authUser.rating || 0,
        totalRides: authUser.totalRides || 0,
        isVerifiedDriver: authUser.isDriverVerified,
        walletBalance: authUser.walletBalance || 0,
      });
    } else {
      setUser(emptyUser);
    }
  }, [authUser]);

  const colorScheme: 'light' | 'dark' =
    themeMode === 'system' ? systemScheme : themeMode;

  const userRole: UserRole = authUser?.role === 'driver' ? 'driver' : 'rider';

  return (
    <AppContext.Provider
      value={{
        themeMode,
        colorScheme,
        setThemeMode,
        userRole,
        user,
        setUser,
        currentLocation,
        setCurrentLocation,
        currentAddress,
        setCurrentAddress,
        destinationLocation,
        setDestinationLocation,
        destinationAddress,
        setDestinationAddress,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext(): AppContextType {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used within AppProvider');
  return ctx;
}

export function useTheme() {
  const { colorScheme } = useAppContext();
  return colorScheme;
}
