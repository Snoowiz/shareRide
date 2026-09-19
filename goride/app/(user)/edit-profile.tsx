import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Image,
  Dimensions
} from 'react-native';
import { useRouter } from 'expo-router';
import RNDateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import { useAppContext } from '@/context/AppContext';
import { Colors } from '@/constants/Colors';
import { supabase } from '@/lib/supabase';
import PhoneInput from '@/components/PhoneInput';
import AlertModal from '@/components/AlertModal';

export default function EditProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { authUser, updateAuthUser } = useAuth();
  const { colorScheme } = useAppContext();
  const C = Colors[colorScheme];

  const [firstName, setFirstName] = useState(authUser?.firstName || '');
  const [lastName, setLastName] = useState(authUser?.lastName || '');
  const [email, setEmail] = useState(authUser?.email || '');
  const [phone, setPhone] = useState(authUser?.phone || '');
  const [avatarUrl, setAvatarUrl] = useState(authUser?.avatar || '');
  const [dob, setDob] = useState(authUser?.dateOfBirth || '');
  const [gender, setGender] = useState(authUser?.gender || '');
  
  const [loading, setLoading] = useState(false);
  const [uploadingAvatar, setIsUploading] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showGenderPicker, setShowGenderPicker] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [alertConfig, setAlertConfig] = useState<{
    visible: boolean;
    title: string;
    message: string;
    type: 'success' | 'info' | 'warning' | 'error';
    confirmText?: string;
    showCancel?: boolean;
    onConfirm?: () => void;
  }>({
    visible: false,
    title: '',
    message: '',
    type: 'info',
  });

  const handleSave = async () => {
    if (!firstName.trim()) {
      setErrors({ firstName: 'First name is required' });
      return;
    }
    if (!lastName.trim()) {
      setErrors({ lastName: 'Last name is required' });
      return;
    }

    setLoading(true);
    setErrors({});

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          phone: phone.trim().replace(/\s+/g, ''),
          email: email.trim().toLowerCase(),
          avatar_url: avatarUrl,
        })
        .eq('id', authUser?.id);

      if (error) throw error;

      // Update user_profiles table
      const { error: userError } = await supabase
        .from('user_profiles')
        .upsert({
          id: authUser?.id,
          date_of_birth: dob || null,
          gender: gender.toLowerCase(),
        });

      if (userError) throw userError;

      // Update local state
      updateAuthUser({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim().replace(/\s+/g, ''),
        email: email.trim().toLowerCase(),
        avatar: avatarUrl,
        dateOfBirth: dob,
        gender: gender.toLowerCase(),
        hasUserProfile: true
      });

      setAlertConfig({
        visible: true,
        title: 'Success',
        message: 'Profile updated successfully',
        type: 'success',
        onConfirm: () => router.back()
      });
    } catch (err: any) {
      setAlertConfig({
        visible: true,
        title: 'Error',
        message: err.message || 'Failed to update profile',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarPress = () => {
    setAlertConfig({
      visible: true,
      title: 'Profile Photo',
      message: 'Would you like to open your gallery to choose a new profile photo?',
      type: 'info',
      confirmText: 'Open Gallery',
      showCancel: true,
      onConfirm: () => pickImage(false)
    });
  };

  const pickImage = async (useCamera: boolean) => {
    try {
      if (useCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          setAlertConfig({ visible: true, title: 'Permission Denied', message: 'Camera access is needed.', type: 'warning' });
          return;
        }
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          setAlertConfig({ visible: true, title: 'Permission Denied', message: 'Gallery access is needed.', type: 'warning' });
          return;
        }
      }

      const result = useCamera
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.7,
            base64: true,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.7,
            base64: true,
          });

      if (!result.canceled && result.assets[0].base64 && authUser) {
        setIsUploading(true);
        const fileExt = result.assets[0].uri.split('.').pop();
        const fileName = `${authUser.id}_${Date.now()}.${fileExt}`;
        const filePath = `avatars/${fileName}`;
        
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, decode(result.assets[0].base64), { contentType: `image/${fileExt}`, upsert: true });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);
        setAvatarUrl(publicUrl);
        
        // Let's immediately update the profile so it's not lost if they forget to hit save
        await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', authUser.id);
        updateAuthUser({ avatar: publicUrl });
        
        setAlertConfig({
          visible: true,
          title: 'Success',
          message: 'Profile photo updated successfully!',
          type: 'success'
        });
        
      }
    } catch (error: any) {
      setAlertConfig({ visible: true, title: 'Error', message: error.message || 'Failed to upload photo', type: 'error' });
    } finally {
      setIsUploading(false);
    }
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      const formatted = selectedDate.toISOString().split('T')[0];
      setDob(formatted);
    }
  };

  const renderInput = (label: string, value: string, onChange: (t: string) => void, icon: string, error?: string, editable = true, onTouch?: () => void) => (
    <View style={s.inputGroup}>
      <Text style={[s.label, { color: C.textSecondary }]}>{label}</Text>
      <TouchableOpacity 
        activeOpacity={onTouch ? 0.7 : 1}
        onPress={onTouch}
        style={[s.inputWrap, { backgroundColor: C.surface, borderColor: error ? Colors.brand.danger : C.border, opacity: editable ? 1 : 0.6 }]}
      >
        <Ionicons name={icon as any} size={20} color={C.textMuted} style={{ marginRight: 12 }} />
        <TextInput
          style={[s.input, { color: C.text }]}
          value={value}
          onChangeText={onChange}
          placeholder={`Enter your ${label.toLowerCase()}`}
          placeholderTextColor={C.textMuted}
          editable={editable && !onTouch}
          pointerEvents={onTouch ? 'none' : 'auto'}
        />
        {onTouch && (
          <Ionicons name="chevron-down" size={18} color={C.textMuted} />
        )}
      </TouchableOpacity>
      {error ? <Text style={s.errorTxt}>{error}</Text> : null}
    </View>
  );

  return (
    <View style={[s.root, { backgroundColor: C.background }]}>
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color={C.text} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: C.text }]}>Edit Profile</Text>
        <TouchableOpacity onPress={handleSave} disabled={loading} style={s.saveBtn}>
          {loading ? <ActivityIndicator size="small" color={Colors.brand.primary} /> : (
            <Text style={[s.saveBtnTxt, { color: Colors.brand.primary }]}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
          <View style={s.avatarSection}>
            <TouchableOpacity onPress={handleAvatarPress} disabled={uploadingAvatar} activeOpacity={0.8}>
              <View style={[s.avatar, { backgroundColor: Colors.brand.primary }]}>
                {avatarUrl ? (
                  <Image source={{ uri: avatarUrl }} style={s.avatarImg} />
                ) : (
                  <Text style={s.avatarTxt}>{firstName[0] || '?'}</Text>
                )}
                {uploadingAvatar && (
                  <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 50, alignItems: 'center', justifyContent: 'center' }]}>
                    <ActivityIndicator color="#fff" />
                  </View>
                )}
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={s.changePhotoBtn} onPress={handleAvatarPress} disabled={uploadingAvatar}>
              <Text style={{ color: Colors.brand.primary, fontWeight: '700' }}>{uploadingAvatar ? 'Uploading...' : 'Change Profile Photo'}</Text>
            </TouchableOpacity>
          </View>

          <View style={s.form}>
            <View style={s.row}>
              <View style={{ flex: 1 }}>
                {renderInput('First Name', firstName, setFirstName, 'person-outline', errors.firstName)}
              </View>
              <View style={{ flex: 1 }}>
                {renderInput('Last Name', lastName, setLastName, 'person-outline', errors.lastName)}
              </View>
            </View>

            {renderInput('Email Address', email, setEmail, 'mail-outline', undefined, false)}
            <Text style={[s.hint, { color: C.textMuted }]}>Email cannot be changed directly for security.</Text>

            <View style={s.inputGroup}>
              <Text style={[s.label, { color: C.textSecondary }]}>Phone Number</Text>
              <PhoneInput
                value={phone}
                onChangeText={setPhone}
              />
            </View>

            <View style={s.row}>
              <View style={{ flex: 1 }}>
                {renderInput('Date of Birth', dob, setDob, 'calendar-outline', undefined, true, () => setShowDatePicker(true))}
              </View>
              <View style={{ flex: 1 }}>
                {renderInput('Gender', gender, setGender, 'person-outline', undefined, true, () => setShowGenderPicker(true))}
              </View>
            </View>

          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {showDatePicker && (
        <RNDateTimePicker
          value={dob ? new Date(dob) : new Date()}
          mode="date"
          display="default"
          onChange={onDateChange}
          maximumDate={new Date()}
        />
      )}

      {/* Gender Picker Modal */}
      {showGenderPicker && (
        <TouchableOpacity 
          style={s.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setShowGenderPicker(false)}
        >
          <View style={[s.pickerModal, { backgroundColor: C.surface }]}>
            <Text style={[s.pickerTitle, { color: C.text }]}>Select Gender</Text>
            {['Male', 'Female', 'Other'].map((g) => (
              <TouchableOpacity 
                key={g} 
                style={s.pickerItem}
                onPress={() => { setGender(g); setShowGenderPicker(false); }}
              >
                <Text style={[s.pickerItemTxt, { color: C.text }]}>{g}</Text>
                {gender.toLowerCase() === g.toLowerCase() && <Ionicons name="checkmark" size={20} color={Colors.brand.primary} />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      )}

      <AlertModal
        isVisible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        confirmText={alertConfig.confirmText}
        showCancel={alertConfig.showCancel}
        onConfirm={alertConfig.onConfirm}
        onClose={() => setAlertConfig(prev => ({ ...prev, visible: false }))}
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
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  saveBtn: { paddingHorizontal: 12, height: 40, justifyContent: 'center' },
  saveBtnTxt: { fontSize: 16, fontWeight: '700' },
  content: { paddingHorizontal: 20, paddingTop: 24 },
  avatarSection: { alignItems: 'center', marginBottom: 32 },
  avatar: { width: 100, height: 100, borderRadius: 50, alignItems: 'center', justifyContent: 'center', marginBottom: 12, overflow: 'hidden' },
  avatarImg: { width: '100%', height: '100%', borderRadius: 50, resizeMode: 'cover' },
  avatarTxt: { color: '#fff', fontSize: 36, fontWeight: '800' },
  changePhotoBtn: { padding: 8 },
  form: { gap: 4 },
  row: { flexDirection: 'row', gap: 12 },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 8, marginLeft: 4 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1.5, paddingHorizontal: 16, height: 56 },
  input: { flex: 1, fontSize: 16, fontWeight: '500' },
  errorTxt: { color: Colors.brand.danger, fontSize: 12, marginTop: 4, marginLeft: 4 },
  hint: { fontSize: 12, marginTop: -12, marginBottom: 20, marginLeft: 4 },
  modalOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  pickerModal: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  pickerTitle: { fontSize: 20, fontWeight: '800', marginBottom: 20 },
  pickerItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' },
  pickerItemTxt: { fontSize: 16, fontWeight: '600' },
});
