import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Linking } from 'react-native';
import Modal from 'react-native-modal';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import * as Location from 'expo-location';

type Props = {
  isVisible: boolean;
  onClose: () => void;
  rideId?: string | null;
};

export default function SOSModal({ isVisible, onClose, rideId }: Props) {
  const { authUser } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleSOS = async () => {
    if (!authUser) return;
    setLoading(true);
    
    try {
      // 1. Get current location
      let lat = null, lng = null;
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          lat = loc.coords.latitude;
          lng = loc.coords.longitude;
        }
      } catch (err) {
        console.warn('Could not get precise location for SOS');
      }

      // 2. Insert SOS alert
      const { error } = await supabase.from('sos_alerts').insert({
        user_id: authUser.id,
        ride_id: rideId || null,
        latitude: lat,
        longitude: lng,
        status: 'active'
      });

      if (error) throw error;

      Alert.alert(
        'SOS Activated',
        'Emergency services and GoRide Support have been notified of your location.',
        [{ text: 'OK', onPress: onClose }]
      );
      
    } catch (err) {
      console.error('SOS Error:', err);
      Alert.alert('Error', 'Could not activate SOS through the app. Please call emergency services directly.');
    } finally {
      setLoading(false);
    }
  };

  const handleCallPolice = () => {
    Linking.openURL('tel:112');
  };

  return (
    <Modal
      isVisible={isVisible}
      onBackdropPress={onClose}
      onSwipeComplete={onClose}
      swipeDirection="down"
      style={s.modal}
      backdropOpacity={0.5}
    >
      <View style={s.container}>
        <View style={s.dragHandle} />
        
        <View style={s.iconWrap}>
          <Ionicons name="warning" size={48} color="#EF4444" />
        </View>
        
        <Text style={s.title}>Emergency SOS</Text>
        <Text style={s.desc}>
          If you feel unsafe or are in an emergency, you can alert GoRide security or call emergency services directly.
        </Text>

        <TouchableOpacity 
          style={s.sosBtn} 
          onPress={handleSOS}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={s.sosTxt}>Alert GoRide Security</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity 
          style={s.callBtn} 
          onPress={handleCallPolice}
          activeOpacity={0.8}
        >
          <Ionicons name="call" size={20} color="#000" style={{ marginRight: 8 }} />
          <Text style={s.callTxt}>Call 112 (Police)</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.cancelBtn} onPress={onClose}>
          <Text style={s.cancelTxt}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  modal: { margin: 0, justifyContent: 'flex-end' },
  container: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    alignItems: 'center',
    paddingBottom: 40,
  },
  dragHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#E2E8F0', marginBottom: 20 },
  iconWrap: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#FEE2E2',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
  },
  title: { fontSize: 24, fontWeight: '800', marginBottom: 12, color: '#0F172A' },
  desc: { fontSize: 15, color: '#64748B', textAlign: 'center', marginBottom: 32, lineHeight: 22 },
  
  sosBtn: {
    width: '100%', height: 56, borderRadius: 16,
    backgroundColor: '#EF4444',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
  },
  sosTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
  
  callBtn: {
    width: '100%', height: 56, borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center', justifyContent: 'center',
    flexDirection: 'row',
    marginBottom: 20,
  },
  callTxt: { color: '#0F172A', fontSize: 16, fontWeight: '700' },
  
  cancelBtn: { padding: 12 },
  cancelTxt: { color: '#64748B', fontSize: 15, fontWeight: '600' },
});
