import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/Colors';
import { useAppContext } from '@/context/AppContext';
import { PARCEL_TYPES, ParcelType } from '@/context/PackageDeliveryContext';

interface Props {
  selected: ParcelType | null;
  onSelect: (type: ParcelType) => void;
  onNext: () => void;
}

export default function ParcelTypeStep({ selected, onSelect, onNext }: Props) {
  const insets = useSafeAreaInsets();
  const { colorScheme } = useAppContext();
  const C = Colors[colorScheme];

  return (
    <View style={s.container}>
      <View style={s.headerSection}>
        <LinearGradient colors={[Colors.brand.primary, Colors.brand.primaryLight]} style={s.iconCircle}>
          <Ionicons name="cube" size={28} color="#fff" />
        </LinearGradient>
        <Text style={[s.title, { color: C.text }]}>What are you sending?</Text>
        <Text style={[s.subtitle, { color: C.textSecondary }]}>Select a parcel category to get started</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.grid}>
        {PARCEL_TYPES.map((type) => {
          const isActive = selected?.id === type.id;
          return (
            <TouchableOpacity
              key={type.id}
              activeOpacity={0.8}
              onPress={() => onSelect(type)}
              style={[
                s.card,
                {
                  backgroundColor: isActive ? Colors.brand.primary + '12' : C.surface,
                  borderColor: isActive ? Colors.brand.primary : C.border,
                },
              ]}
            >
              <View style={[s.cardIcon, { backgroundColor: isActive ? Colors.brand.primary + '20' : C.surfaceAlt }]}>
                <Ionicons name={type.icon as any} size={24} color={isActive ? Colors.brand.primary : C.textMuted} />
              </View>
              <Text style={[s.cardLabel, { color: isActive ? Colors.brand.primary : C.text }]}>{type.label}</Text>
              <Text style={[s.cardDesc, { color: C.textMuted }]} numberOfLines={1}>{type.description}</Text>
              {isActive && (
                <View style={s.checkMark}>
                  <Ionicons name="checkmark-circle" size={20} color={Colors.brand.primary} />
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <TouchableOpacity
        activeOpacity={0.85}
        disabled={!selected}
        onPress={onNext}
        style={{ marginTop: 16, marginBottom: Math.max(insets.bottom, 16) }}
      >
        <LinearGradient
          colors={selected ? [Colors.brand.primary, Colors.brand.primaryLight] : [C.surfaceAlt, C.surfaceAlt]}
          style={s.nextBtn}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          <Ionicons name="cube-outline" size={20} color={selected ? '#fff' : C.textMuted} />
          <Text style={[s.nextBtnTxt, { color: selected ? '#fff' : C.textMuted }]}>Add Parcel Info</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20 },
  headerSection: { alignItems: 'center', marginBottom: 24, marginTop: 8 },
  iconCircle: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  title: { fontSize: 22, fontWeight: '800', letterSpacing: -0.3, marginBottom: 6 },
  subtitle: { fontSize: 14, fontWeight: '500', textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingBottom: 12 },
  card: {
    width: '47%',
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 16,
    alignItems: 'center',
    position: 'relative',
  },
  cardIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  cardLabel: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
  cardDesc: { fontSize: 11, fontWeight: '500', textAlign: 'center' },
  checkMark: { position: 'absolute', top: 8, right: 8 },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 17,
    borderRadius: 14,
    elevation: 4,
    shadowColor: Colors.brand.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  nextBtnTxt: { fontSize: 16, fontWeight: '800' },
});
