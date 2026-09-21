import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { AppState, AppStateStatus, View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import Modal from 'react-native-modal';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import type { Session, User } from '@supabase/supabase-js';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';

export type AuthRole = 'user' | 'driver';
export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

export interface AuthUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  avatar: string | null;
  role: AuthRole;
  isDriverVerified: boolean;
  hasDriverProfile: boolean;
  hasUserProfile: boolean;
  rating?: number;
  totalRides?: number;
  walletBalance?: number;
  bankName?: string;
  accountNumber?: string;
  accountName?: string;
  driverType?: string;
  rideTypeId?: string;
  dateOfBirth?: string;
  gender?: string;
  driversLicenseUrl?: string;
  profilePhotoUrl?: string;
  ninSlipUrl?: string;
  idBackUrl?: string;
  selfieUrl?: string;
  vehicleYear?: string;
  vehicleMake?: string;
  licensePlate?: string;
  vehicleColor?: string;
  vehicleParticularsUrl?: string;
  vehicleExteriorUrl?: string;
  residentialAddress?: string;
  nextOfKinName?: string;
  nextOfKinPhone?: string;
  nextOfKinRelationship?: string;
  licenseNumber?: string;
  verificationStatus?: string;
}

export interface DriverSignupData {
  driverType: string | null;
  rideTypeId?: string | null;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: 'male' | 'female' | 'other' | '';
  phone: string;
  email: string;
  vehicleType: 'Car' | 'Motorcycle' | 'Bicycle';
  vehicleMake: string;
  vehicleYear: string;
  licensePlate: string;
  vehicleColor: string;
  driversLicenseUri: string;
  profilePhotoUri: string;
  ninSlipUri: string;
  vehicleParticularsUri: string;
  vehicleExteriorUri: string;
  licenseNumber: string;
  nextOfKinName: string;
  nextOfKinPhone: string;
  nextOfKinRelationship: string;
  billingType: string;
  residentialAddress: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  password?: string;
  confirmPassword?: string;
}

export const emptyDriverSignup: DriverSignupData = {
  driverType: null,
  rideTypeId: null,
  firstName: '',
  lastName: '',
  dateOfBirth: '',
  gender: '',
  phone: '',
  email: '',
  vehicleType: 'Car',
  vehicleMake: '',
  vehicleYear: '',
  licensePlate: '',
  vehicleColor: '',
  driversLicenseUri: '',
  profilePhotoUri: '',
  ninSlipUri: '',
  vehicleParticularsUri: '',
  vehicleExteriorUri: '',
  licenseNumber: '',
  nextOfKinName: '',
  nextOfKinPhone: '',
  nextOfKinRelationship: '',
  billingType: '',
  residentialAddress: '',
  bankName: '',
  accountNumber: '',
  accountName: '',
  password: '',
  confirmPassword: '',
};

const ROLE_STORAGE_KEY = '@goride_user_role';
const DRIVER_SIGNUP_STORAGE_KEY = '@goride_driver_signup_data';

interface AuthContextType {
  status: AuthStatus;
  session: Session | null;
  authUser: AuthUser | null;
  selectedRole: AuthRole;
  setSelectedRole: (role: AuthRole) => void;
  signUpWithEmail: (email: string, password: string, meta: { firstName: string; lastName: string; phone: string; role: AuthRole }) => Promise<{ error: string | null }>;
  signInWithEmail: (email: string, password: string) => Promise<{ error: string | null }>;
  signInWithPhone: (phone: string, password: string) => Promise<{ error: string | null }>;
  signUpWithPhone: (phone: string, password: string, meta: { firstName: string; lastName: string; role: AuthRole }) => Promise<{ error: string | null }>;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  checkUserExists: (identifier: string, method: 'phone' | 'email') => Promise<boolean>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (password: string) => Promise<{ error: string | null }>;
  updateAuthUser: (updates: Partial<AuthUser>) => void;
  refreshUser: () => Promise<void>;
  saveDriverProfile: (data: DriverSignupData) => Promise<{ error: string | null }>;
  driverSignupData: DriverSignupData;
  setDriverSignupData: React.Dispatch<React.SetStateAction<DriverSignupData>>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Fetch profile from Supabase and map to AuthUser
async function fetchProfile(userId: string): Promise<AuthUser | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*, driver_profiles(*), user_profiles(*)')
    .eq('id', userId)
    .single();

  if (error || !data) return null;

  const dp = Array.isArray(data.driver_profiles) ? data.driver_profiles[0] : data.driver_profiles;
  const up = Array.isArray(data.user_profiles) ? data.user_profiles[0] : data.user_profiles;

  const isDriverVerified = data.is_driver_verified === true || dp?.verification_status === 'approved' || dp?.verification_status === 'verified';
  const isUserVerified = up?.verification_status === 'approved' || up?.verification_status === 'verified';

  let verificationStatus = 'unverified';
  if (data.role === 'driver' || isDriverVerified || dp?.verification_status) {
    if (isDriverVerified) {
      verificationStatus = 'approved';
    } else if (dp?.verification_status === 'pending') {
      verificationStatus = 'pending';
    } else if (dp?.verification_status === 'rejected') {
      verificationStatus = 'rejected';
    }
  } else {
    if (isUserVerified) {
      verificationStatus = 'approved';
    } else if (up?.verification_status === 'pending') {
      verificationStatus = 'pending';
    } else if (up?.verification_status === 'rejected') {
      verificationStatus = 'rejected';
    }
  }

  return {
    id: data.id,
    firstName: data.first_name || '',
    lastName: data.last_name || '',
    email: '', // fetched from session
    phone: data.phone || '',
    avatar: data.avatar_url,
    role: data.role as AuthRole,
    isDriverVerified: isDriverVerified,
    hasDriverProfile: !!dp,
    hasUserProfile: !!up,
    
    // Driver fields
    driverType: dp?.driver_type ?? undefined,
    rideTypeId: dp?.ride_type_id ?? undefined,
    bankName: dp?.bank_name ?? '',
    accountNumber: dp?.account_number ?? '',
    accountName: dp?.account_name ?? '',
    
    // Shared / Role specific profile fields
    dateOfBirth: dp?.date_of_birth || up?.date_of_birth || '',
    gender: dp?.gender || up?.gender || '',
    residentialAddress: dp?.residential_address || up?.residential_address || '',
    
    // Document URLs
    driversLicenseUrl: dp?.drivers_license_url ?? '',
    profilePhotoUrl: dp?.profile_photo_url ?? '',
    ninSlipUrl: dp?.nin_slip_url || up?.id_front_url || '', // Reuse ninSlipUrl for rider ID front
    idBackUrl: up?.id_back_url || '',
    selfieUrl: up?.selfie_url || '',
    
    // Vehicle fields
    vehicleYear: dp?.vehicle_year ?? '',
    vehicleMake: dp?.vehicle_make ?? '',
    licensePlate: dp?.license_plate ?? '',
    vehicleColor: dp?.vehicle_color ?? '',
    vehicleParticularsUrl: dp?.vehicle_particulars_url ?? '',
    vehicleExteriorUrl: dp?.vehicle_exterior_url ?? '',
    licenseNumber: dp?.license_number ?? '',
    
    // Emergency contact
    nextOfKinName: dp?.next_of_kin_name ?? '',
    nextOfKinPhone: dp?.next_of_kin_phone ?? '',
    nextOfKinRelationship: dp?.next_of_kin_relationship ?? '',
    
    // Verification
    verificationStatus: verificationStatus,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [session, setSession] = useState<Session | null>(null);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [selectedRole, setSelectedRoleState] = useState<AuthRole>('user');
  const [driverSignupData, setDriverSignupData] = useState<DriverSignupData>(emptyDriverSignup);
  const [displacedAlert, setDisplacedAlert] = useState(false);
  const sessionIdRef = useRef<string | null>(null);
  const isSigningOut = useRef(false);

  // Persist driver signup data
  useEffect(() => {
    if (driverSignupData !== emptyDriverSignup) {
      AsyncStorage.setItem(DRIVER_SIGNUP_STORAGE_KEY, JSON.stringify(driverSignupData));
    }
  }, [driverSignupData]);

  // Load driver signup data
  useEffect(() => {
    AsyncStorage.getItem(DRIVER_SIGNUP_STORAGE_KEY).then((json) => {
      if (json) {
        try {
          const parsed = JSON.parse(json);
          setDriverSignupData(parsed);
        } catch (e) {
          console.warn('Failed to parse driver signup data');
        }
      }
    });
  }, []);

  // Persist selected role
  const setSelectedRole = useCallback(async (role: AuthRole) => {
    setSelectedRoleState(role);
    await AsyncStorage.setItem(ROLE_STORAGE_KEY, role);
  }, []);

  // Load role + listen for auth state changes
  useEffect(() => {
    // Load persisted role
    AsyncStorage.getItem(ROLE_STORAGE_KEY).then((role) => {
      if (role === 'user' || role === 'driver') setSelectedRoleState(role);
    });

    // Handle OAuth redirect manually if needed
    const handleDeepLink = (url: string) => {
      // Parse query params
      const parsed = Linking.parse(url);
      let accessToken = parsed.queryParams?.access_token as string;
      let refreshToken = parsed.queryParams?.refresh_token as string;

      // Fallback: Parse fragment (#) if query params are missing (common in Supabase OAuth)
      if (!accessToken && url.includes('#')) {
        const fragment = url.split('#')[1];
        const params = new URLSearchParams(fragment);
        accessToken = params.get('access_token') || '';
        refreshToken = params.get('refresh_token') || '';
      }

      if (accessToken) {
        supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken || '',
        });
      }
    };

    const l = Linking.addEventListener('url', (event) => handleDeepLink(event.url));
    Linking.getInitialURL().then((url) => { if (url) handleDeepLink(url); });

    // Get current session with safety catch
    supabase.auth.getSession().then(async ({ data: { session: s }, error }) => {
      if (error) {
        // If the token is invalid or missing, just sign out to clear local storage
        if (error.message.includes('Refresh Token Not Found') || error.message.includes('Invalid Refresh Token')) {
          await supabase.auth.signOut();
        }
        setStatus('unauthenticated');
        return;
      }

      try {
        setSession(s);
        if (s?.user) {
          const profile = await fetchProfile(s.user.id);
          if (profile) {
            profile.email = s.user.email || '';
            setAuthUser(profile);
            const savedRole = await AsyncStorage.getItem(ROLE_STORAGE_KEY);
            if (!savedRole) {
              setSelectedRoleState(profile.role);
            }
          }
          setStatus('authenticated');
        } else {
          setStatus('unauthenticated');
        }
      } catch (err) {
        console.error('Initialization error:', err);
        setStatus('unauthenticated');
      }
    }).catch(async (err) => {
      // Catch any unhandled promise rejections
      if (err.message?.includes('Refresh Token')) {
        await supabase.auth.signOut();
      }
      setStatus('unauthenticated');
    });

    // Listen for auth changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, s) => {
      setSession(s);
      
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (s?.user) {
          const profile = await fetchProfile(s.user.id);
          if (profile) {
            profile.email = s.user.email || '';
            setAuthUser(profile);
          }
          setStatus('authenticated');

          // ── Single-device enforcement: stamp session on login ──
          if (event === 'SIGNED_IN' && s.access_token) {
            const sid = s.access_token.slice(-16); // Use last 16 chars as a unique fingerprint
            sessionIdRef.current = sid;
            await supabase
              .from('profiles')
              .update({ active_session_id: sid })
              .eq('id', s.user.id);
          }
        }
      } else if (event === 'SIGNED_OUT') {
        sessionIdRef.current = null;
        setAuthUser(null);
        setSession(null);
        setStatus('unauthenticated');
      }
    });

    return () => {
      l.remove();
      subscription.unsubscribe();
    };
  }, []);

  const refreshUser = useCallback(async () => {
    const currentId = session?.user?.id || authUser?.id;
    if (!currentId) return;
    try {
      const profile = await fetchProfile(currentId);
      if (profile) {
        profile.email = session?.user?.email || authUser?.email || profile.email;
        setAuthUser(profile);
      }
    } catch (err) {
      console.warn('refreshUser failed:', err);
    }
  }, [session?.user?.id, session?.user?.email, authUser?.id, authUser?.email]);

  // ── Single-device session enforcement & Realtime Profile Sync ─────
  // Check on app resume if another device has taken over the session, and keep profile fresh
  useEffect(() => {
    if (status !== 'authenticated' || !authUser?.id) return;

    const checkSessionValidity = async () => {
      if (isSigningOut.current || !sessionIdRef.current) return;
      const { data } = await supabase
        .from('profiles')
        .select('active_session_id')
        .eq('id', authUser.id)
        .single();

      if (data && data.active_session_id && data.active_session_id !== sessionIdRef.current) {
        // Another device has logged in — force logout
        isSigningOut.current = true;
        setDisplacedAlert(true);
      }
    };

    // Check when app comes back to foreground
    const handleAppState = (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        checkSessionValidity();
        refreshUser();
      }
    };
    const appStateSub = AppState.addEventListener('change', handleAppState);

    // Also subscribe to realtime changes on this user's profile and driver/user profile rows
    const channel = supabase
      .channel(`session-and-profile-${authUser.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'profiles',
        filter: `id=eq.${authUser.id}`,
      }, (payload: any) => {
        const newSessionId = payload.new?.active_session_id;
        if (newSessionId && sessionIdRef.current && newSessionId !== sessionIdRef.current) {
          if (!isSigningOut.current) {
            isSigningOut.current = true;
            setDisplacedAlert(true);
          }
        }
        refreshUser();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'driver_profiles',
        filter: `id=eq.${authUser.id}`,
      }, () => {
        refreshUser();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'user_profiles',
        filter: `id=eq.${authUser.id}`,
      }, () => {
        refreshUser();
      })
      .subscribe();

    return () => {
      appStateSub.remove();
      supabase.removeChannel(channel);
    };
  }, [status, authUser?.id, refreshUser]);

  // ── Auth methods ──

  const signUpWithEmail = useCallback(async (
    email: string,
    password: string,
    meta: { firstName: string; lastName: string; phone: string; role: AuthRole },
  ) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: meta.firstName,
          last_name: meta.lastName,
          phone: meta.phone.replace(/\s+/g, ''),
          email: email.toLowerCase(),
          role: meta.role,
        },
      },
    });
    if (error) return { error: error.message };

    // Update role in context
    await setSelectedRole(meta.role);
    return { error: null };
  }, [setSelectedRole]);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return { error: null };
  }, []);

  const signUpWithPhone = useCallback(async (
    phone: string,
    password: string,
    meta: { firstName: string; lastName: string; role: AuthRole },
  ) => {
    const normalized = phone.replace(/\s+/g, '');
    const { error } = await supabase.auth.signUp({
      phone: normalized,
      password,
      options: {
        data: {
          first_name: meta.firstName,
          last_name: meta.lastName,
          phone: normalized,
          role: meta.role,
        },
      },
    });
    if (error) return { error: error.message };
    await setSelectedRole(meta.role);
    return { error: null };
  }, [setSelectedRole]);

  const signInWithPhone = useCallback(async (phone: string, password: string) => {
    const normalized = phone.replace(/\s+/g, '');
    
    try {
      // UNIFIED LOGIN STRATEGY:
      // Find the associated email using a secure RPC that can join with auth.users
      const { data: profileResults, error: rpcError } = await supabase.rpc('get_profile_by_phone', { p_phone: normalized });

      if (!rpcError && profileResults && profileResults.length > 0) {
        const associatedEmail = profileResults[0].user_email;
        if (associatedEmail) {
          const { error: emailError } = await supabase.auth.signInWithPassword({ 
            email: associatedEmail, 
            password 
          });
          if (!emailError) return { error: null };
          if (emailError.message.toLowerCase().includes('invalid login credentials')) {
            return { error: 'Invalid password. Please try again.' };
          }
        }
      }

      // FALLBACK: Try direct phone sign-in (requires Phone Auth to be enabled/confirmed)
      const { error } = await supabase.auth.signInWithPassword({ phone: normalized, password });
      if (error) {
        if (error.message.toLowerCase().includes('invalid login credentials')) {
          return { error: 'Invalid password. Please try again.' };
        }
        return { error: error.message };
      }
      return { error: null };
    } catch (e: any) {
      return { error: e.message || 'An unexpected error occurred' };
    }
  }, []);

  const signInWithGoogle = useCallback(async () => {
    try {
      const redirectTo = Linking.createURL('/');
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: true,
        },
      });

      if (error) return { error: error.message };

      if (data?.url) {
        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
        if (result.type === 'success') {
          const { url } = result;
          const parsed = Linking.parse(url);
          if (parsed.queryParams?.access_token) {
            const { error: sessionError } = await supabase.auth.setSession({
              access_token: parsed.queryParams.access_token as string,
              refresh_token: (parsed.queryParams.refresh_token as string) || '',
            });
            if (sessionError) return { error: sessionError.message };
          }
        }
      }
      return { error: null };
    } catch (e: any) {
      return { error: e.message || 'Google login failed' };
    }
  }, []);

  const checkUserExists = useCallback(async (identifier: string, method: 'phone' | 'email'): Promise<boolean> => {
    // Normalize: remove spaces for phone numbers
    const normalized = method === 'phone' ? identifier.replace(/\s+/g, '') : identifier.trim().toLowerCase();

    try {
      // Use our secure RPC to check existence in the profiles table
      const { data, error } = await supabase.rpc('check_user_exists', { 
        p_identifier: normalized, 
        p_method: method 
      });

      if (error) {
        console.error('Error checking user existence:', error);
        return false;
      }
      
      return !!data;
    } catch (e) {
      console.error('Unexpected error during checkUserExists:', e);
      return false;
    }
  }, []);

  const signOut = useCallback(async () => {
    // 1. If currently a driver, mark as offline in DB first
    if (authUser?.id && selectedRole === 'driver') {
      try {
        await supabase.from('available_drivers').update({ is_online: false }).eq('id', authUser.id);
      } catch (err) {
        console.warn('Failed to mark offline during signout:', err);
      }
    }

    // 2. Clear Supabase session and local state
    await supabase.auth.signOut();
    setAuthUser(null);
    setSession(null);
    setStatus('unauthenticated');
    setDriverSignupData(emptyDriverSignup);
    await AsyncStorage.removeItem(ROLE_STORAGE_KEY);
    await AsyncStorage.removeItem(DRIVER_SIGNUP_STORAGE_KEY);
  }, [authUser, selectedRole]);

  const resetPassword = useCallback(async (email: string) => {
    const redirectTo = Linking.createURL('/(auth)/update-password');
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo,
    });
    return { error: error?.message || null };
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    return { error: error?.message || null };
  }, []);

  const updateAuthUser = useCallback((updates: Partial<AuthUser>) => {
    setAuthUser((prev) => (prev ? { ...prev, ...updates } : null));
  }, []);

  const saveDriverProfile = useCallback(async (data: DriverSignupData) => {
    const userId = authUser?.id || session?.user?.id;
    if (!userId) return { error: 'Not authenticated' };

    try {
      // Ensure the profiles row exists (handles race condition with auth trigger)
      // Use upsert so it creates the row if the trigger hasn't fired yet
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({ 
          id: userId,
          first_name: data.firstName,
          last_name: data.lastName,
          phone: data.phone?.replace(/\s+/g, ''),
          role: 'driver',
          avatar_url: data.profilePhotoUri || null,
        }, { onConflict: 'id' });

      if (profileError) return { error: profileError.message };

      // Upsert driver profile (FK constraint is now satisfied)
      const { error: driverError } = await supabase
        .from('driver_profiles')
        .upsert({
          id: userId,
          ride_type_id: data.rideTypeId || null,
          driver_type: data.driverType || data.vehicleType.toLowerCase(),
          drivers_license_url: data.driversLicenseUri,
          profile_photo_url: data.profilePhotoUri,
          nin_slip_url: data.ninSlipUri,
          vehicle_year: data.vehicleYear,
          vehicle_make: data.vehicleMake,
          license_plate: data.licensePlate,
          vehicle_color: data.vehicleColor,
          vehicle_particulars_url: data.vehicleParticularsUri,
          vehicle_exterior_url: data.vehicleExteriorUri,
          license_number: data.licenseNumber,
          next_of_kin_name: data.nextOfKinName,
          next_of_kin_phone: data.nextOfKinPhone,
          billing_type: data.billingType,
          residential_address: data.residentialAddress,
          date_of_birth: data.dateOfBirth,
          gender: data.gender?.toLowerCase(),
          bank_name: data.bankName,
          account_number: data.accountNumber,
          account_name: data.accountName,
        }, { onConflict: 'id' });

      if (driverError) return { error: driverError.message };

      // Update local state
      updateAuthUser({ 
        role: 'driver', 
        hasDriverProfile: true, // Crucial to prevent redirect loops
        driverType: data.driverType || undefined,
        bankName: data.bankName,
        accountNumber: data.accountNumber,
        accountName: data.accountName,
        dateOfBirth: data.dateOfBirth,
        gender: data.gender,
        driversLicenseUrl: data.driversLicenseUri || '',
        profilePhotoUrl: data.profilePhotoUri || '',
        ninSlipUrl: data.ninSlipUri || '',
        vehicleYear: data.vehicleYear,
        vehicleMake: data.vehicleMake,
        licensePlate: data.licensePlate,
        vehicleColor: data.vehicleColor,
        vehicleParticularsUrl: data.vehicleParticularsUri || '',
        vehicleExteriorUrl: data.vehicleExteriorUri || '',
        residentialAddress: data.residentialAddress,
        nextOfKinName: data.nextOfKinName,
        nextOfKinPhone: data.nextOfKinPhone,
        nextOfKinRelationship: data.nextOfKinRelationship,
      });
      await setSelectedRole('driver');
      return { error: null };
    } catch (e: any) {
      console.error('saveDriverProfile error:', e);
      return { error: e.message || 'Failed to save driver profile' };
    }
  }, [authUser, session, updateAuthUser, setSelectedRole]);
  // Handle forced logout when displaced by another device
  const handleDisplacedConfirm = useCallback(async () => {
    setDisplacedAlert(false);
    sessionIdRef.current = null;
    isSigningOut.current = false;
    await signOut();
  }, [signOut]);

  return (
    <AuthContext.Provider
      value={{
        status, session, authUser, selectedRole, setSelectedRole,
        signUpWithEmail, signInWithEmail, signInWithPhone, signUpWithPhone,
        signInWithGoogle, checkUserExists, signOut, resetPassword, updatePassword,
        updateAuthUser, refreshUser, saveDriverProfile,
        driverSignupData, setDriverSignupData,
      }}
    >
      {children}
      {/* Self-contained displaced session modal — no external context dependencies */}
      <Modal
        isVisible={displacedAlert}
        backdropOpacity={0.6}
        animationIn="zoomIn"
        animationOut="zoomOut"
        useNativeDriver
      >
        <View style={dStyles.container}>
          <View style={dStyles.iconBg}>
            <Ionicons name="warning" size={40} color="#F59E0B" />
          </View>
          <Text style={dStyles.title}>Signed In Elsewhere</Text>
          <Text style={dStyles.message}>
            Your account was signed in on another device. For security, you have been logged out of this device.
          </Text>
          <TouchableOpacity style={dStyles.btn} onPress={handleDisplacedConfirm} activeOpacity={0.85}>
            <Text style={dStyles.btnTxt}>OK</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

const { width: screenWidth } = Dimensions.get('window');
const dStyles = StyleSheet.create({
  container: {
    backgroundColor: '#1E293B',
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    width: screenWidth * 0.85,
    alignSelf: 'center',
  },
  iconBg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(245,158,11,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 12,
  },
  message: {
    fontSize: 15,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 22,
    fontWeight: '500',
    marginBottom: 28,
  },
  btn: {
    width: '100%',
    backgroundColor: '#FCCA14',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  btnTxt: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0D1B3E',
  },
});
