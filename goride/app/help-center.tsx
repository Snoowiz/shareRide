import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Linking, Image } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppContext } from '@/context/AppContext';
import { Colors } from '@/constants/Colors';

const FAQS = [
  { q: "How do I update my payment method?", a: "Go to your Wallet or Bank Details screen to add or update your preferred payment methods." },
  { q: "How are driver earnings calculated?", a: "Earnings are calculated based on the base fare, distance, and time, minus the platform commission." },
  { q: "I left an item in the ride. What should I do?", a: "You can use the 'Contact Driver' option in your ride history within 24 hours, or contact support." },
  { q: "How do I report a safety issue?", a: "Please use the SOS button during an active ride, or contact our 24/7 emergency support team below." }
];

export default function HelpCenterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colorScheme } = useAppContext();
  const C = Colors[colorScheme];
  const [search, setSearch] = useState('');
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const filteredFaqs = FAQS.filter(f => f.q.toLowerCase().includes(search.toLowerCase()));

  const contactMethods = [
    { icon: 'call', title: 'Call Us', color: '#10B981', action: () => Linking.openURL('tel:+1234567890') },
    { icon: 'mail', title: 'Email', color: '#3B82F6', action: () => Linking.openURL('mailto:support@goride.com') },
    { icon: 'chatbubbles', title: 'Live Chat', color: '#8B5CF6', action: () => router.push('/support-chat') },
  ];

  return (
    <View style={[s.root, { backgroundColor: C.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color={C.text} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: C.text }]}>Help Center</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <Image 
          source={require('@/assets/images/help_support.png')} 
          style={s.heroImage}
          resizeMode="contain"
        />

        <View style={[s.searchWrap, { backgroundColor: C.surface, borderColor: C.border }]}>
          <Ionicons name="search" size={20} color={C.textMuted} />
          <TextInput
            style={[s.searchInput, { color: C.text }]}
            placeholder="Search for help..."
            placeholderTextColor={C.textMuted}
            value={search}
            onChangeText={setSearch}
          />
        </View>

        <Text style={[s.sectionTitle, { color: C.text }]}>Frequently Asked Questions</Text>
        <View style={s.faqList}>
          {filteredFaqs.map((faq, index) => {
            const isExpanded = expandedIndex === index;
            return (
              <TouchableOpacity 
                key={index} 
                style={[s.faqItem, { backgroundColor: C.surface, borderColor: C.border }]} 
                onPress={() => setExpandedIndex(isExpanded ? null : index)}
                activeOpacity={0.7}
              >
                <View style={s.faqRow}>
                  <Text style={[s.faqQ, { color: C.text }]}>{faq.q}</Text>
                  <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={20} color={C.textMuted} />
                </View>
                {isExpanded && (
                  <View style={s.faqAContainer}>
                    <Text style={[s.faqA, { color: C.textSecondary }]}>{faq.a}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={[s.sectionTitle, { color: C.text, marginTop: 32 }]}>Contact Support</Text>
        <Text style={[s.contactSub, { color: C.textMuted }]}>Our team is available 24/7 to assist you.</Text>
        
        <View style={s.contactGrid}>
          {contactMethods.map((method, i) => (
            <TouchableOpacity 
              key={i} 
              style={[s.contactCard, { backgroundColor: C.surface, borderColor: C.border }]}
              onPress={method.action}
              activeOpacity={0.7}
            >
              <View style={[s.contactIconBox, { backgroundColor: method.color + '15' }]}>
                <Ionicons name={method.icon as any} size={24} color={method.color} />
              </View>
              <Text style={[s.contactTitle, { color: C.text }]}>{method.title}</Text>
            </TouchableOpacity>
          ))}
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
  heroImage: { width: '100%', height: 180, marginBottom: 24 },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', height: 50,
    borderRadius: 12, borderWidth: 1, paddingHorizontal: 16, gap: 10,
    marginBottom: 32
  },
  searchInput: { flex: 1, fontSize: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16 },
  faqList: { gap: 12 },
  faqItem: { borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  faqRow: { flexDirection: 'row', padding: 16, justifyContent: 'space-between', alignItems: 'center' },
  faqQ: { flex: 1, fontSize: 15, fontWeight: '600', paddingRight: 16 },
  faqAContainer: { padding: 16, paddingTop: 0 },
  faqA: { fontSize: 14, lineHeight: 22 },
  contactSub: { fontSize: 14, marginBottom: 20, marginTop: -10 },
  contactGrid: { flexDirection: 'row', gap: 12 },
  contactCard: { flex: 1, padding: 16, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  contactIconBox: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  contactTitle: { fontSize: 14, fontWeight: '600' },
});
