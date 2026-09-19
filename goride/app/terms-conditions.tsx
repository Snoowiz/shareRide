import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppContext } from '@/context/AppContext';
import { Colors } from '@/constants/Colors';

export default function TermsConditionsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colorScheme } = useAppContext();
  const C = Colors[colorScheme];

  return (
    <View style={[s.root, { backgroundColor: C.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color={C.text} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: C.text }]}>Terms & Conditions</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <View style={s.card}>
          <Text style={[s.lastUpdated, { color: C.textMuted }]}>Last Updated: May 15, 2026</Text>

          <Text style={[s.title, { color: C.text }]}>1. Agreement to Terms</Text>
          <Text style={[s.paragraph, { color: C.textSecondary }]}>
            By accessing or using the GoRide platform (including the GoRide Driver and Rider applications), you agree to be bound by these Terms and Conditions. If you disagree with any part of these terms, you may not access the service.
          </Text>

          <Text style={[s.title, { color: C.text }]}>2. User Responsibilities</Text>
          <Text style={[s.paragraph, { color: C.textSecondary }]}>
            Users must provide accurate, complete, and current information. You are responsible for safeguarding your account details and maintaining the confidentiality of your login credentials. Drivers are additionally responsible for maintaining valid licenses, insurance, and vehicle standards.
          </Text>

          <Text style={[s.title, { color: C.text }]}>3. Payments and Fares</Text>
          <Text style={[s.paragraph, { color: C.textSecondary }]}>
            Fares are calculated based on distance, time, and current demand (surge pricing). All payments must be completed through the app. Drivers receive payments to their designated bank accounts on a scheduled basis, minus the standard platform commission.
          </Text>

          <Text style={[s.title, { color: C.text }]}>4. Safety and Conduct</Text>
          <Text style={[s.paragraph, { color: C.textSecondary }]}>
            GoRide maintains a zero-tolerance policy for discrimination, harassment, or unsafe behavior. We reserve the right to immediately suspend or terminate accounts that violate our community safety guidelines.
          </Text>

          <Text style={[s.title, { color: C.text }]}>5. Limitation of Liability</Text>
          <Text style={[s.paragraph, { color: C.textSecondary }]}>
            GoRide acts as a technology platform connecting riders and drivers. We do not provide transportation services ourselves and are not directly responsible for the actions, omissions, or behavior of users on the platform.
          </Text>

          <Text style={[s.title, { color: C.text }]}>6. Changes to Terms</Text>
          <Text style={[s.paragraph, { color: C.textSecondary }]}>
            We may modify these Terms at any time. We will provide notice of significant changes through the app. Continued use of the platform after changes constitutes acceptance of the new Terms.
          </Text>
        </View>

        <TouchableOpacity style={[s.acceptBtn, { backgroundColor: Colors.brand.primary }]} onPress={() => router.back()}>
          <Text style={s.acceptBtnTxt}>I Understand</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  content: { padding: 20, paddingBottom: 40 },
  card: { gap: 12, marginBottom: 32 },
  lastUpdated: { fontSize: 13, marginBottom: 16 },
  title: { fontSize: 16, fontWeight: '700', marginTop: 12 },
  paragraph: { fontSize: 15, lineHeight: 24 },
  acceptBtn: { height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  acceptBtnTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
