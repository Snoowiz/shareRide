import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/Colors';
import { useAppContext } from '@/context/AppContext';
import { VEHICLE_TYPES, VehicleType } from '@/context/PackageDeliveryContext';

interface Props {
  selected: VehicleType | null;
  distanceKm: number;
  onSelect: (v: VehicleType) => void;
  onNext: () => void;
}

const formatCurrency = (n: number) => `₦${n.toLocaleString('en-NG', { minimumFractionDigits: 0 })}`;

export default function VehicleStep({ selected, distanceKm, onSelect, onNext }: Props) {
  const insets = useSafeAreaInsets();
  const { colorScheme } = useAppContext();
  const C = Colors[colorScheme];

  return (
    <View style={s.container}>
      <Text style={[s.title, { color: C.text }]}>Choose Vehicle</Text>
      <Text style={[s.subtitle, { color: C.textSecondary }]}>
        Select the best option for your delivery
      </Text>

      {distanceKm > 0 && (
        <View style={[s.distRow, { backgroundColor: C.surfaceAlt }]}>
          <Ionicons name="navigate-outline" size={16} color={Colors.brand.primary} />
          <Text style={[s.distTxt, { color: C.text }]}>Total Distance: <Text style={{ fontWeight: '800' }}>{distanceKm.toFixed(1)} km</Text></Text>
        </View>
      )}

      <View style={s.vehicleList}>
        {VEHICLE_TYPES.map((v) => {
          const isActive = selected?.id === v.id;
          const estimatedFare = v.baseFare + (distanceKm * v.pricePerKm);

          return (
            <TouchableOpacity
              key={v.id}
              activeOpacity={0.8}
              onPress={() => onSelect(v)}
              style={[s.vehicleCard, {
                backgroundColor: isActive ? Colors.brand.primary + '10' : C.surface,
                borderColor: isActive ? Colors.brand.primary : C.border,
              }]}
            >
              <View style={[s.vehicleIcon, { backgroundColor: isActive ? Colors.brand.primary + '20' : C.surfaceAlt }]}>
                <Ionicons name={v.icon as any} size={32} color={isActive ? Colors.brand.primary : C.textMuted} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.vehicleName, { color: C.text }]}>{v.name}</Text>
                <Text style={[s.vehicleCap, { color: C.textMuted }]}>{v.capacity}</Text>
                {distanceKm > 0 && (
                  <Text style={[s.vehicleDist, { color: C.textSecondary }]}>{distanceKm.toFixed(1)} km route</Text>
                )}
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[s.fare, { color: Colors.brand.primary }]}>
                  {distanceKm > 0 ? formatCurrency(Math.round(estimatedFare / 50) * 50) : formatCurrency(v.baseFare)}
                </Text>
                <Text style={[s.fareLabel, { color: C.textMuted }]}>est. fare</Text>
              </View>
              {isActive && (
                <View style={s.check}>
                  <Ionicons name="checkmark-circle" size={22} color={Colors.brand.primary} />
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={{ flex: 1 }} />

      <TouchableOpacity 
        activeOpacity={0.85} 
        disabled={!selected} 
        onPress={onNext}
        style={{ marginBottom: Math.max(insets.bottom, 16) }}
      >
        <LinearGradient
          colors={selected ? [Colors.brand.primary, Colors.brand.primaryLight] : [C.surfaceAlt, C.surfaceAlt]}
          style={s.nextBtn}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          <Ionicons name="shield-checkmark-outline" size={20} color={selected ? '#fff' : C.textMuted} />
          <Text style={[s.nextBtnTxt, { color: selected ? '#fff' : C.textMuted }]}>Choose the efficient Vehicle</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20 },
  title: { fontSize: 22, fontWeight: '800', letterSpacing: -0.3, marginBottom: 4 },
  subtitle: { fontSize: 14, fontWeight: '500', marginBottom: 16 },
  distRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: 16,
  },
  distTxt: { fontSize: 14, fontWeight: '500' },
  vehicleList: { gap: 12 },
  vehicleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 16,
    borderWidth: 2,
    position: 'relative',
  },
  vehicleIcon: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  vehicleName: { fontSize: 17, fontWeight: '800', marginBottom: 2 },
  vehicleCap: { fontSize: 12, fontWeight: '500' },
  vehicleDist: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  fare: { fontSize: 16, fontWeight: '800' },
  fareLabel: { fontSize: 11, fontWeight: '500' },
  check: { position: 'absolute', top: 10, right: 10 },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 17,
    borderRadius: 14,
  },
  nextBtnTxt: { fontSize: 15, fontWeight: '800' },
});
