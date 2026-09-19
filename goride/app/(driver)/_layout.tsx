import React from 'react';
import { Stack } from 'expo-router';

export default function DriverLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="edit-profile" options={{ gestureEnabled: true, presentation: 'card' }} />
      <Stack.Screen name="bank-details" options={{ gestureEnabled: true, presentation: 'card' }} />
      <Stack.Screen name="vehicle-registration" options={{ gestureEnabled: true, presentation: 'card' }} />
      <Stack.Screen name="document-registration" options={{ gestureEnabled: true, presentation: 'card' }} />
      <Stack.Screen name="active-trip" options={{ gestureEnabled: false }} />
      <Stack.Screen name="active-delivery" options={{ gestureEnabled: false }} />
      <Stack.Screen name="wallet-topup" options={{ presentation: 'modal' }} />
      <Stack.Screen name="withdrawal-request" options={{ presentation: 'modal' }} />
      <Stack.Screen name="notifications" options={{ gestureEnabled: true, presentation: 'card' }} />
    </Stack>
  );
}
