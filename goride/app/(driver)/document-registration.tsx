import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform, Image, TextInput
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

export default function DocumentRegistrationScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { authUser, updateAuthUser } = useAuth();
  const { colorScheme } = useAppContext();
  const C = Colors[colorScheme];
  const accentColor = Colors.driver.primary;

  const [licenseUrl, setLicenseUrl] = useState(authUser?.driversLicenseUrl || '');
  const [profilePhotoUrl, setProfilePhotoUrl] = useState(authUser?.profilePhotoUrl || '');
  const [ninSlipUrl, setNinSlipUrl] = useState(authUser?.ninSlipUrl || '');
  
  const [licenseNumber, setLicenseNumber] = useState(authUser?.licenseNumber || '');
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
      fetchDocs();
    }
  }, [authUser?.id]);

  const fetchDocs = async () => {
    try {
      const { data, error } = await supabase
        .from('driver_profiles')
        .select('drivers_license_url, profile_photo_url, nin_slip_url')
        .eq('id', authUser?.id)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setLicenseUrl(data.drivers_license_url || '');
        setProfilePhotoUrl(data.profile_photo_url || '');
        setNinSlipUrl(data.nin_slip_url || '');
        
        // Update context if needed
        updateAuthUser({
          driversLicenseUrl: data.drivers_license_url || '',
          profilePhotoUrl: data.profile_photo_url || '',
          ninSlipUrl: data.nin_slip_url || '',
        });
      }
    } catch (err: any) {
      console.error('Error fetching docs:', err);
    } finally {
      setFetching(false);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('driver_profiles')
        .upsert({
          id: authUser?.id,
          drivers_license_url: licenseUrl,
          profile_photo_url: profilePhotoUrl,
          nin_slip_url: ninSlipUrl,
          license_number: licenseNumber.trim(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'id' });

      if (error) throw error;
      
      updateAuthUser({
        driversLicenseUrl: licenseUrl,
        profilePhotoUrl: profilePhotoUrl,
        ninSlipUrl: ninSlipUrl,
        licenseNumber: licenseNumber.trim(),
      });

      setAlertConfig({
        visible: true,
        title: 'Success',
        message: 'Documents updated and under review',
        type: 'success',
        onConfirm: () => setAlertConfig({ ...alertConfig, visible: false })
      });
    } catch (err: any) {
      setAlertConfig({
        visible: true,
        title: 'Error',
        message: err.message || 'Failed to update documents',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async (field: 'license' | 'photo' | 'nin') => {
    try {
      let result;
      
      if (field === 'photo') {
        // Launch camera specifically for profile photo
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.7,
        });
      } else {
        // Launch library for documents
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [16, 9],
          quality: 0.7,
        });
      }

      if (!result.canceled && result.assets && result.assets[0].uri) {
        setLoading(true);
        const uri = result.assets[0].uri;
        const extension = uri.split('.').pop();
        const path = `identity/${authUser?.id}/${field}_${Date.now()}.${extension}`;
        
        const publicUrl = await uploadImage('driver-docs', path, uri);
        
        if (field === 'license') setLicenseUrl(publicUrl);
        else if (field === 'photo') setProfilePhotoUrl(publicUrl);
        else setNinSlipUrl(publicUrl);
        
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

  const renderDocCard = (label: string, value: string, icon: string, onUpdate: () => void) => {
    let description = "Upload a clear picture of the document.";
    if (label === "Profile Photo") {
      description = "Take a clear portrait picture (not a full body picture) of yourself. It should show your full face, front view, with eyes open. (Do not wear a cap, earphones, or glasses)";
    } else if (label === "Driver's License") {
      description = "Upload a clear picture of your valid driver's license.";
    } else if (label === "NIN Slip") {
      description = "Upload your National Identity Number slip.";
    }

    return (
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
            <Text style={[s.updateBtnTxt, { color: C.text }]}>
              {label === "Profile Photo" ? (value ? 'Retake' : 'Take Photo') : (value ? 'Change' : 'Upload')}
            </Text>
          </TouchableOpacity>
        </View>
        {!value && (
          <Text style={[s.docDesc, { color: C.textSecondary }]}>{description}</Text>
        )}
        {value ? (
          <View style={[s.preview, { borderColor: C.border, marginTop: 12 }]}>
            <Image source={{ uri: value }} style={s.previewImg} />
            <TouchableOpacity style={s.removeImg} onPress={() => {
              if (label.includes("License")) setLicenseUrl('');
              else if (label.includes("Photo")) setProfilePhotoUrl('');
              else setNinSlipUrl('');
            }}>
              <Ionicons name="close-circle" size={24} color={Colors.brand.danger} />
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    );
  };

  if (fetching) {
    return (
      <View style={[s.root, { backgroundColor: C.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={accentColor} />
      </View>
    );
  }

  const totalFields = 4;
  let filledFields = 0;
  if (licenseNumber.trim()) filledFields++;
  if (licenseUrl) filledFields++;
  if (profilePhotoUrl) filledFields++;
  if (ninSlipUrl) filledFields++;
  const progressPercent = Math.round((filledFields / totalFields) * 100);
  const isVerified = Boolean(
    authUser?.isDriverVerified ||
    authUser?.verificationStatus === 'approved' ||
    authUser?.verificationStatus === 'verified'
  );
  const isPending = !isVerified && authUser?.verificationStatus === 'pending';
  const isRejected = !isVerified && authUser?.verificationStatus === 'rejected';

  return (
    <View style={[s.root, { backgroundColor: C.background }]}>
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <View style={s.headerSide}>
          <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(driver)/(tabs)/profile')} style={s.backBtn}>
            <Ionicons name="chevron-back" size={24} color={C.text} />
          </TouchableOpacity>
        </View>
        <Text style={[s.headerTitle, { color: C.text }]}>Documents</Text>
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

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
          <View style={s.intro}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <Text style={[s.introTitle, { color: C.text }]}>Identity Verification</Text>
              {isVerified ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.brand.success + '15', borderColor: Colors.brand.success + '30', borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, gap: 4 }}>
                  <Ionicons name="shield-checkmark" size={13} color={Colors.brand.success} />
                  <Text style={{ fontSize: 12, fontWeight: '700', color: Colors.brand.success }}>Approved</Text>
                </View>
              ) : isPending ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.brand.warning + '15', borderColor: Colors.brand.warning + '30', borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, gap: 4 }}>
                  <Ionicons name="time" size={13} color={Colors.brand.warning} />
                  <Text style={{ fontSize: 12, fontWeight: '700', color: Colors.brand.warning }}>Under Review</Text>
                </View>
              ) : isRejected ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#EF444415', borderColor: '#EF444430', borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, gap: 4 }}>
                  <Ionicons name="close-circle" size={13} color="#EF4444" />
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#EF4444' }}>Rejected</Text>
                </View>
              ) : null}
            </View>
            <Text style={[s.introSub, { color: C.textSecondary }]}>
              {isVerified 
                ? 'Your driver documents have been approved and verified by the admin.'
                : 'Ensure all documents are clear and valid. Updates may trigger a re-verification process.'}
            </Text>
          </View>

          <View style={{ gap: 16 }}>
            {renderInput("Driver's License Number", licenseNumber, setLicenseNumber, 'card-outline', 'ABC123456789', 'default', 'characters')}
            
            <View style={[s.divider, { backgroundColor: C.border, marginVertical: 8 }]} />
            
            {renderDocCard("Driver's License", licenseUrl, 'card-outline', () => pickImage('license'))}
            {renderDocCard("Profile Photo", profilePhotoUrl, 'camera-outline', () => pickImage('photo'))}
            {renderDocCard("NIN Slip", ninSlipUrl, 'document-text-outline', () => pickImage('nin'))}
          </View>

          <View style={[s.infoBox, { backgroundColor: C.surfaceAlt }]}>
            <Ionicons name="information-circle-outline" size={20} color={C.textMuted} />
            <Text style={[s.infoBoxTxt, { color: C.textMuted }]}>
              Your documents are securely stored and only used for verification purposes.
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
  intro: { marginBottom: 24 },
  introTitle: { fontSize: 22, fontWeight: '800', marginBottom: 8 },
  introSub: { fontSize: 14, lineHeight: 20 },
  sectionTitle: { fontSize: 17, fontWeight: '700', marginTop: 12, marginBottom: 12 },
  docList: { gap: 16, marginBottom: 32 },
  docCard: { borderRadius: 16, overflow: 'hidden' },
  docInfo: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 12 },
  docIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  docLabel: { fontSize: 16, fontWeight: '700' },
  docStatus: { fontSize: 13, marginTop: 1 },
  docDesc: { fontSize: 12, lineHeight: 18, color: '#64748b', marginTop: 8, marginLeft: 58 },
  updateBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  updateBtnTxt: { fontSize: 13, fontWeight: '600' },
  preview: { height: 160, borderRadius: 12, borderWidth: 1, overflow: 'hidden', position: 'relative' },
  previewImg: { width: '100%', height: '100%' },
  removeImg: { position: 'absolute', top: 8, right: 8, backgroundColor: '#fff', borderRadius: 12 },
  inputGroup: { gap: 8 },
  label: { fontSize: 14, fontWeight: '600' },
  inputWrap: { height: 50, borderRadius: 12, borderWidth: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 },
  input: { flex: 1, fontSize: 15 },
  divider: { height: 1, width: '100%' },
  infoBox: { flexDirection: 'row', padding: 16, borderRadius: 12, gap: 12, alignItems: 'center' },
  infoBoxTxt: { flex: 1, fontSize: 12, lineHeight: 18 },
});
