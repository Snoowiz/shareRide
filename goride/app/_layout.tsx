import { DarkTheme, DefaultTheme, ThemeProvider, Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';
import 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import React, { useEffect } from 'react';

import { AppProvider, useAppContext } from '@/context/AppContext';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { NotificationProvider } from '@/context/NotificationContext';
import { Colors } from '@/constants/Colors';
import { supabase } from '@/lib/supabase';
import { Alert } from 'react-native';
import { useRef } from 'react';
import { PaystackProvider } from 'react-native-paystack-webview';

function GlobalUserListener() {
  const { status, authUser, selectedRole } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  
  const handledRides = useRef(new Set<string>());
  const handledDeliveries = useRef(new Set<string>());

  useEffect(() => {
    if (status !== 'authenticated' || !authUser || selectedRole !== 'user') return;

    // Listen for accepted rides
    const ridesChannel = supabase
      .channel('global-rides-listener')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rides', filter: `rider_id=eq.${authUser.id}` },
        (payload) => {
          if (payload.new.status === 'accepted') {
            if (!handledRides.current.has(payload.new.id)) {
              handledRides.current.add(payload.new.id);
              const isAlreadyOnTrip = segments[segments.length - 1] === 'trip-progress';
              if (!isAlreadyOnTrip) {
                 router.replace(`/trip-progress?rideId=${payload.new.id}`);
              }
            }
          }
        }
      )
      .subscribe();

    // Listen for accepted deliveries
    const deliveriesChannel = supabase
      .channel('global-deliveries-listener')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'deliveries', filter: `rider_id=eq.${authUser.id}` },
        (payload) => {
          if (payload.new.status === 'accepted') {
            if (!handledDeliveries.current.has(payload.new.id)) {
               handledDeliveries.current.add(payload.new.id);
               const isAlreadyOnProgress = segments[segments.length - 1] === 'package-progress';
               if (!isAlreadyOnProgress) {
                 router.replace(`/package-progress?deliveryId=${payload.new.id}`);
               }
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ridesChannel);
      supabase.removeChannel(deliveriesChannel);
    };
  }, [status, authUser, selectedRole, segments]);

  return null;
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const { status, authUser } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (status === 'loading') return; // still initializing

    const inAuthGroup = segments[0] === '(auth)';
    const inUserGroup = segments[0] === '(user)';
    const inDriverGroup = segments[0] === '(driver)';
    const len = segments.length as number;
    const isRootIndex = len === 0 || (len === 1 && (segments[0] as any) === 'index');

    if (status === 'authenticated' && authUser) {
      // Use the immutable role from the database profile
      const role = authUser.role; // 'user' or 'driver'
      let target = role === 'driver' ? '/(driver)/(tabs)' : '/(user)/(tabs)';
      
      // If driver role but profile is missing, redirect to signup
      if (role === 'driver' && !authUser.hasDriverProfile) {
        target = '/(auth)/driver-signup';
      }
      
      const currentPath = `/${segments.join('/')}`;
      const isAlreadyAtTarget = currentPath === target;
      const isUpdatePassword = currentPath.includes('update-password');
      
      if ((inAuthGroup || isRootIndex) && !isAlreadyAtTarget && !isUpdatePassword) {
        router.replace(target as any);
      } else if (inUserGroup && role === 'driver' && !isUpdatePassword) {
        router.replace(target as any);
      } else if (inDriverGroup && role === 'user' && !isUpdatePassword) {
        router.replace('/(user)/(tabs)');
      }
    } else if (status === 'unauthenticated') {
      // Kick unauthenticated users out of protected groups back to role selection.
      if (inUserGroup || inDriverGroup) {
        // Small delay to ensure the session clear-out completes before navigation
        setTimeout(() => {
          router.replace('/');
        }, 100);
      }
    }
  }, [status, authUser, segments]);

  if (status === 'loading') {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#080C14' }}>
        <ActivityIndicator size="large" color={Colors.brand.secondary} />
      </View>
    );
  }

  // Prevent flash of protected content when signing out
  const inUserGroup = segments[0] === '(user)';
  const inDriverGroup = segments[0] === '(driver)';
  if (status === 'unauthenticated' && (inUserGroup || inDriverGroup)) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#080C14' }}>
        <ActivityIndicator size="small" color={Colors.brand.secondary} />
      </View>
    );
  }

  return <>{children}</>;
}

function RootLayoutInner() {
  const { colorScheme } = useAppContext();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AuthGate>
        <GlobalUserListener />
        <Stack>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(user)" options={{ headerShown: false }} />
          <Stack.Screen name="(driver)" options={{ headerShown: false }} />
          <Stack.Screen name="destination" options={{ presentation: 'modal', headerShown: false }} />
          <Stack.Screen name="book-ride" options={{ headerShown: false }} />
          <Stack.Screen name="trip-progress" options={{ headerShown: false, gestureEnabled: false }} />
          <Stack.Screen name="rate-trip" options={{ headerShown: false, gestureEnabled: false }} />
          <Stack.Screen name="send-package" options={{ headerShown: false }} />
          <Stack.Screen name="chat" options={{ headerShown: false }} />
        </Stack>
      </AuthGate>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
    </ThemeProvider>
  );
}

function DynamicPaystackWrapper({ children }: { children: React.ReactNode }) {
  const { paymentConfig } = useAppContext();
  const activePublicKey = paymentConfig.paystackPublicKey || '';

  return (
    <PaystackProvider 
      publicKey={activePublicKey}
      defaultChannels={['card', 'bank', 'ussd', 'bank_transfer']}
    >
      {children}
    </PaystackProvider>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <AppProvider>
          <DynamicPaystackWrapper>
            <NotificationProvider>
              <RootLayoutInner />
            </NotificationProvider>
          </DynamicPaystackWrapper>
        </AppProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
