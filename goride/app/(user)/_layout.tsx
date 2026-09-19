import React from 'react';
import { Stack } from 'expo-router';

export default function UserLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="edit-profile" options={{ gestureEnabled: true, presentation: 'card' }} />
      <Stack.Screen name="saved-places" options={{ gestureEnabled: true, presentation: 'card' }} />
      <Stack.Screen name="notifications" options={{ gestureEnabled: true, presentation: 'card' }} />
    </Stack>
  );
}
