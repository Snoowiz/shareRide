import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, Linking } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppContext } from '@/context/AppContext';
import { Colors } from '@/constants/Colors';
import Constants from 'expo-constants';

export default function AboutScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colorScheme } = useAppContext();
  const C = Colors[colorScheme];

  const appVersion = Constants.expoConfig?.version || '1.0.0';

  const socialLinks = [
    { name: 'Website', icon: 'globe-outline', url: 'https://goride.com' },
    { name: 'Twitter', icon: 'logo-twitter', url: 'https://twitter.com/goride' },
    { name: 'Instagram', icon: 'logo-instagram', url: 'https://instagram.com/goride' },
    { name: 'Facebook', icon: 'logo-facebook', url: 'https://facebook.com/goride' },
  ];

  return (
    <View style={[s.root, { backgroundColor: C.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color={C.text} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: C.text }]}>About GoRide</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <View style={s.logoContainer}>
          <View style={[s.logoBox, { backgroundColor: Colors.brand.primary }]}>
            <Ionicons name="car-sport" size={48} color="#fff" />
          </View>
          <Text style={[s.appName, { color: C.text }]}>GoRide</Text>
          <Text style={[s.appVersion, { color: C.textMuted }]}>Version {appVersion}</Text>
        </View>

        <Text style={[s.description, { color: C.textSecondary }]}>
          GoRide is a premium unified ride-sharing and delivery platform designed to seamlessly connect riders, senders, and drivers. Our mission is to provide safe, fast, and reliable transportation and logistics solutions across the city.
        </Text>

        <View style={s.section}>
          <Text style={[s.sectionTitle, { color: C.text }]}>Connect With Us</Text>
          <View style={[s.card, { backgroundColor: C.surface, borderColor: C.border }]}>
            {socialLinks.map((link, index) => (
              <React.Fragment key={index}>
                <TouchableOpacity 
                  style={s.row} 
                  activeOpacity={0.7}
                  onPress={() => {}}
                >
                  <View style={s.rowLeft}>
                    <Ionicons name={link.icon as any} size={22} color={C.text} />
                    <Text style={[s.rowTitle, { color: C.text }]}>{link.name}</Text>
                  </View>
                  <Ionicons name="open-outline" size={18} color={C.textMuted} />
                </TouchableOpacity>
                {index < socialLinks.length - 1 && <View style={[s.divider, { backgroundColor: C.border }]} />}
              </React.Fragment>
            ))}
          </View>
        </View>

        <View style={s.footer}>
          <Text style={[s.copyright, { color: C.textMuted }]}>© {new Date().getFullYear()} GoRide Technologies Inc.</Text>
          <Text style={[s.copyright, { color: C.textMuted }]}>All rights reserved.</Text>
        </View>
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
  logoContainer: { alignItems: 'center', marginTop: 20, marginBottom: 32 },
  logoBox: { width: 100, height: 100, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 5 },
  appName: { fontSize: 24, fontWeight: '800', marginBottom: 4 },
  appVersion: { fontSize: 14, fontWeight: '500' },
  description: { fontSize: 15, lineHeight: 24, textAlign: 'center', marginBottom: 40, paddingHorizontal: 10 },
  section: { marginBottom: 40 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 16 },
  card: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  rowTitle: { fontSize: 16, fontWeight: '500' },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 52 },
  footer: { alignItems: 'center', marginTop: 'auto' },
  copyright: { fontSize: 13, marginTop: 4 },
});
