import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform, Image
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import { useAppContext } from '@/context/AppContext';
import { Colors } from '@/constants/Colors';
import { supabase } from '@/lib/supabase';
import * as ImagePicker from 'expo-image-picker';
import { uploadImage } from '@/lib/storage';
import AlertModal from '@/components/AlertModal';

export default function VehicleRegistrationScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { authUser, updateAuthUser } = useAuth();
  const { colorScheme } = useAppContext();
  const C = Colors[colorScheme];
  const isDark = colorScheme === 'dark';
  const accentColor = Colors.driver.primary;

  const [year, setYear] = useState(authUser?.vehicleYear || '');
  const [make, setMake] = useState(authUser?.vehicleMake || '');
  const [plate, setPlate] = useState(authUser?.licensePlate || '');
  const [color, setColor] = useState(authUser?.vehicleColor || '');
  const [particularsUrl, setParticularsUrl] = useState(authUser?.vehicleParticularsUrl || '');
  const [exteriorUrl, setExteriorUrl] = useState(authUser?.vehicleExteriorUrl || '');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  
  const [alertConfig, setAlertConfig] = useState<{
    visible: boolean;
    title: string;
    message: string;
    type: 'success' | 'info' | 'warning' | 'error';
    onConfirm?: () => void;
  }>({
    visible: false,
    title: '',
    message: '',
    type: 'info',
  });

  useEffect(() => {
    if (authUser?.id) {
      fetchVehicleInfo();
    }
  }, [authUser?.id]);

  const fetchVehicleInfo = async () => {
    try {
      const { data, error } = await supabase
        .from('driver_profiles')
        .select('vehicle_year, vehicle_make, license_plate, vehicle_color, vehicle_particulars_url, vehicle_exterior_url')
        .eq('id', authUser?.id)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setYear(data.vehicle_year || '');
        setMake(data.vehicle_make || '');
        setPlate(data.license_plate || '');
        setColor(data.vehicle_color || '');
        setParticularsUrl(data.vehicle_particulars_url || '');
        setExteriorUrl(data.vehicle_exterior_url || '');
        
        updateAuthUser({
          vehicleYear: data.vehicle_year || '',
          vehicleMake: data.vehicle_make || '',
          licensePlate: data.license_plate || '',
          vehicleColor: data.vehicle_color || '',
          vehicleParticularsUrl: data.vehicle_particulars_url || '',
          vehicleExteriorUrl: data.vehicle_exterior_url || '',
        });
      }
    } catch (err: any) {
      console.error('Error fetching vehicle info:', err);
    } finally {
      setFetching(false);
    }
  };

  const handleSave = async () => {
    if (!year.trim() || !make.trim() || !plate.trim() || !color.trim()) {
      setAlertConfig({
        visible: true,
        title: 'Error',
        message: 'Please fill in all vehicle details.',
        type: 'error'
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('driver_profiles')
        .upsert({
          id: authUser?.id,
          vehicle_year: year.trim(),
          vehicle_make: make.trim(),
          license_plate: plate.trim().toUpperCase(),
          vehicle_color: color.trim(),
          vehicle_particulars_url: particularsUrl,
          vehicle_exterior_url: exteriorUrl,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'id' });

      if (error) throw error;
      
      updateAuthUser({
        vehicleYear: year.trim(),
        vehicleMake: make.trim(),
        licensePlate: plate.trim().toUpperCase(),
        vehicleColor: color.trim(),
        vehicleParticularsUrl: particularsUrl,
        vehicleExteriorUrl: exteriorUrl,
      });

      setAlertConfig({
        visible: true,
        title: 'Success',
        message: 'Vehicle information updated successfully',
        type: 'success',
        onConfirm: () => setAlertConfig({ ...alertConfig, visible: false })
      });
    } catch (err: any) {
      setAlertConfig({
        visible: true,
        title: 'Error',
        message: err.message || 'Failed to update vehicle info',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async (field: 'particulars' | 'exterior') => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.7,
      });

      if (!result.canceled && result.assets && result.assets[0].uri) {
        setLoading(true);
        const uri = result.assets[0].uri;
        const extension = uri.split('.').pop();
        const path = `vehicles/${authUser?.id}/${field}_${Date.now()}.${extension}`;
        
        const publicUrl = await uploadImage('driver-docs', path, uri);
        
        if (field === 'particulars') setParticularsUrl(publicUrl);
        else setExteriorUrl(publicUrl);
        
        setLoading(false);
      }
    } catch (err: any) {
      setLoading(false);
      setAlertConfig({
        visible: true,
        title: 'Upload Failed',
        message: err.message || 'Failed to pick or upload image',
        type: 'error'
      });
    }
  };

  const renderInput = (label: string, value: string, onChange: (t: string) => void, icon: string, placeholder: string, keyboardType: any = 'default', autoCap: any = 'words') => (
    <View style={s.inputGroup}>
      <Text style={[s.label, { color: C.textSecondary }]}>{label}</Text>
      <View style={[s.inputWrap, { backgroundColor: C.surface, borderColor: C.border }]}>
        <Ionicons name={icon as any} size={20} color={C.textMuted} style={{ marginRight: 12 }} />
        <TextInput
          style={[s.input, { color: C.text }]}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={C.textMuted}
          keyboardType={keyboardType}
          autoCapitalize={autoCap}
        />
      </View>
    </View>
  );

  const renderDocCard = (label: string, value: string, icon: string, onUpdate: () => void) => (
    <View style={s.docCard}>
      <View style={s.docInfo}>
        <View style={[s.docIcon, { backgroundColor: accentColor + '15' }]}>
          <Ionicons name={icon as any} size={22} color={accentColor} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[s.docLabel, { color: C.text }]}>{label}</Text>
          <Text style={[s.docStatus, { color: value ? Colors.brand.primary : C.textMuted }]}>
            {value ? 'Uploaded • Reviewing' : 'Required'}
          </Text>
        </View>
        <TouchableOpacity 
          style={[s.updateBtn, { backgroundColor: C.surfaceAlt }]} 
          onPress={onUpdate}
        >
          <Text style={[s.updateBtnTxt, { color: C.text }]}>{value ? 'Change' : 'Upload'}</Text>
        </TouchableOpacity>
      </View>
      {value ? (
        <View style={[s.preview, { borderColor: C.border }]}>
           <Image source={{ uri: value }} style={s.previewImg} />
           <TouchableOpacity style={s.removeImg} onPress={() => {
             if (label === "Vehicle Particulars") setParticularsUrl('');
             else setExteriorUrl('');
           }}>
              <Ionicons name="close-circle" size={24} color={Colors.brand.danger} />
           </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );

  if (fetching) {
    return (
      <View style={[s.root, { backgroundColor: C.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={accentColor} />
      </View>
    );
  }

  const totalFields = 6;
  let filledFields = 0;
  if (year.trim()) filledFields++;
  if (make.trim()) filledFields++;
  if (plate.trim()) filledFields++;
  if (color.trim()) filledFields++;
  if (particularsUrl) filledFields++;
  if (exteriorUrl) filledFields++;
  const progressPercent = Math.round((filledFields / totalFields) * 100);

  return (
    <View style={[s.root, { backgroundColor: C.background }]}>
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <View style={s.headerSide}>
          <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(driver)/(tabs)/profile')} style={s.backBtn}>
            <Ionicons name="chevron-back" size={24} color={C.text} />
          </TouchableOpacity>
        </View>
        <Text style={[s.headerTitle, { color: C.text }]}>Vehicle Info</Text>
        <View style={[s.headerSide, { alignItems: 'flex-end' }]}>
          <View style={s.progressWrap}>
            <Text style={[s.progressTxt, { color: progressPercent === 100 ? Colors.brand.primary : C.textSecondary }]}>
              {progressPercent}%
            </Text>
            <View style={[s.progressTrack, { backgroundColor: C.border }]}>
              <View style={[s.progressFill, { width: `${progressPercent}%`, backgroundColor: progressPercent === 100 ? Colors.brand.primary : accentColor }]} />
            </View>
          </View>
          <TouchableOpacity onPress={handleSave} disabled={loading} style={s.saveBtn}>
            {loading ? <ActivityIndicator size="small" color={accentColor} /> : (
              <Text style={[s.saveBtnTxt, { color: accentColor }]}>Save</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
          <View style={s.intro}>
             <View style={[s.introIcon, { backgroundColor: accentColor + '15' }]}>
                <Ionicons name="car" size={32} color={accentColor} />
             </View>
            <Text style={[s.introTitle, { color: C.text }]}>Your Vehicle</Text>
            <Text style={[s.introSub, { color: C.textSecondary }]}>
              Keep your vehicle details up to date to ensure riders can easily identify you.
            </Text>
          </View>

          <View style={s.form}>
            {renderInput('Vehicle Year', year, setYear, 'calendar-outline', 'e.g. 2022', 'number-pad')}
            {renderInput('Make & Model', make, setMake, 'car-sport-outline', 'e.g. Toyota Corolla')}
            {renderInput('License Plate', plate, setPlate, 'barcode-outline', 'e.g. ABC-123-XY', 'default', 'characters')}
            {renderInput('Color', color, setColor, 'color-palette-outline', 'e.g. Silver')}
          </View>

          <View style={s.docsSection}>
            <Text style={[s.sectionTitle, { color: C.text }]}>Vehicle Documents</Text>
            
            <View style={s.docList}>
              {renderDocCard("Vehicle Particulars", particularsUrl, 'document-attach-outline', () => pickImage('particulars'))}
              {renderDocCard("Exterior Photo", exteriorUrl, 'car-outline', () => pickImage('exterior'))}
            </View>
          </View>

          <View style={[s.warningBox, { backgroundColor: Colors.brand.warning + '10', borderColor: Colors.brand.warning + '30' }]}>
            <Ionicons name="alert-circle-outline" size={20} color={Colors.brand.warning} />
            <Text style={[s.warningBoxTxt, { color: C.textSecondary }]}>
              Changing your vehicle may require our team to re-verify your vehicle particulars.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <AlertModal
        isVisible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        onConfirm={alertConfig.onConfirm}
        onClose={() => setAlertConfig({ ...alertConfig, visible: false })}
      />
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
  headerSide: { flex: 1, justifyContent: 'center' },
  progressWrap: { alignItems: 'center', justifyContent: 'center', marginRight: 55 },
  progressTxt: { fontSize: 11, fontWeight: '800', marginBottom: 2 },
  progressTrack: { width: 40, height: 4, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2 },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  saveBtn: { position: 'absolute', right: 0, paddingHorizontal: 12, height: 40, justifyContent: 'center' },
  saveBtnTxt: { fontSize: 16, fontWeight: '700' },
  content: { padding: 20 },
  intro: { alignItems: 'center', marginBottom: 32 },
  introIcon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  introTitle: { fontSize: 22, fontWeight: '800', marginBottom: 8 },
  introSub: { fontSize: 14, textAlign: 'center', lineHeight: 20, paddingHorizontal: 20 },
  form: { gap: 4 },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 8, marginLeft: 4 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1.5, paddingHorizontal: 16, height: 56 },
  input: { flex: 1, fontSize: 16, fontWeight: '500' },
  docsSection: { marginTop: 32 },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 20 },
  docList: { gap: 16 },
  docCard: { borderRadius: 16, overflow: 'hidden', marginBottom: 8 },
  docInfo: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 12 },
  docIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  docLabel: { fontSize: 16, fontWeight: '700' },
  docStatus: { fontSize: 13, marginTop: 1 },
  updateBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  updateBtnTxt: { fontSize: 13, fontWeight: '600' },
  preview: { height: 160, borderRadius: 12, borderWidth: 1, overflow: 'hidden', position: 'relative' },
  previewImg: { width: '100%', height: '100%' },
  removeImg: { position: 'absolute', top: 8, right: 8, backgroundColor: '#fff', borderRadius: 12 },
  warningBox: { flexDirection: 'row', padding: 16, borderRadius: 12, borderWidth: 1, marginTop: 32, gap: 12, alignItems: 'flex-start' },
  warningBoxTxt: { flex: 1, fontSize: 13, lineHeight: 18 },
});
