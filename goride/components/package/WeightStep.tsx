import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Image, ActivityIndicator, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/Colors';
import { useAppContext } from '@/context/AppContext';
import { ParcelType } from '@/context/PackageDeliveryContext';
import { supabase } from '@/lib/supabase';

interface Props {
  parcelType: ParcelType;
  weight: string;
  onWeightChange: (w: string) => void;
  parcelImageUrl: string | null;
  onImageChange: (url: string | null) => void;
  termsAccepted: boolean;
  onTermsChange: (accepted: boolean) => void;
  onSave: () => void;
}

export default function WeightStep({ 
  parcelType, 
  weight, 
  onWeightChange, 
  parcelImageUrl, 
  onImageChange, 
  termsAccepted, 
  onTermsChange, 
  onSave 
}: Props) {
  const insets = useSafeAreaInsets();
  const { colorScheme } = useAppContext();
  const C = Colors[colorScheme];
  const [uploading, setUploading] = useState(false);

  const valid = weight.trim().length > 0 && parseFloat(weight) > 0 && termsAccepted;

  const pickImage = async (useCamera: boolean = false) => {
    try {
      const permission = useCamera 
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert('Permission Denied', `We need ${useCamera ? 'camera' : 'gallery'} access to upload an item image.`);
        return;
      }

      const result = await (useCamera 
        ? ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.5 })
        : ImagePicker.launchImageLibraryAsync({ allowsEditing: true, quality: 0.5 }));

      if (!result.canceled && result.assets && result.assets.length > 0) {
        uploadImage(result.assets[0].uri);
      }
    } catch (err) {
      console.error('Pick image error:', err);
    }
  };

  const uploadImage = async (uri: string) => {
    setUploading(true);
    try {
      const fileName = `parcel_${Date.now()}.jpg`;
      const formData = new FormData();
      formData.append('file', {
        uri: Platform.OS === 'ios' ? uri.replace('file://', '') : uri,
        name: fileName,
        type: 'image/jpeg',
      } as any);

      const { data, error } = await supabase.storage
        .from('parcel-images')
        .upload(fileName, formData);

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('parcel-images')
        .getPublicUrl(fileName);

      onImageChange(publicUrl);
    } catch (err: any) {
      console.error('Upload error:', err);
      onImageChange(uri);
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={s.container}>
      {/* Parcel type display */}
      <View style={[s.typeCard, { backgroundColor: C.surface, borderColor: C.border }]}>
        <View style={[s.typeIcon, { backgroundColor: Colors.brand.primary + '15' }]}>
          <Ionicons name={parcelType.icon as any} size={28} color={Colors.brand.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[s.typeLabel, { color: C.text }]}>{parcelType.label}</Text>
          <Text style={[s.typeDesc, { color: C.textMuted }]}>{parcelType.description}</Text>
        </View>
        <Ionicons name="checkmark-circle" size={22} color="#22C55E" />
      </View>

      {/* Weight Input */}
      <View style={s.weightSection}>
        <Text style={[s.sectionTitle, { color: C.text }]}>Parcel Weight</Text>
        <Text style={[s.hint, { color: C.textMuted }]}>Enter the approximate weight of your parcel</Text>

        <View style={[s.weightInputWrap, { backgroundColor: C.surface, borderColor: C.border }]}>
          <Ionicons name="scale-outline" size={22} color={Colors.brand.primary} style={{ marginRight: 12 }} />
          <TextInput
            style={[s.weightInput, { color: C.text }]}
            placeholder="0.0"
            placeholderTextColor={C.textMuted}
            value={weight}
            onChangeText={(t) => onWeightChange(t.replace(/[^0-9.]/g, ''))}
            keyboardType="decimal-pad"
            returnKeyType="done"
          />
          <View style={[s.unitBadge, { backgroundColor: Colors.brand.primary + '15' }]}>
            <Text style={[s.unitTxt, { color: Colors.brand.primary }]}>kg</Text>
          </View>
        </View>

        {/* Quick weight presets */}
        <View style={s.presets}>
          {['0.5', '1', '2', '5', '10'].map((w) => (
            <TouchableOpacity
              key={w}
              activeOpacity={0.8}
              onPress={() => onWeightChange(w)}
              style={[s.preset, {
                backgroundColor: weight === w ? Colors.brand.primary : C.surface,
                borderColor: weight === w ? Colors.brand.primary : C.border,
              }]}
            >
              <Text style={[s.presetTxt, { color: weight === w ? '#fff' : C.textSecondary }]}>{w} kg</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Image Upload Section */}
      <View style={s.imageSection}>
        <Text style={[s.sectionTitle, { color: C.text }]}>Item Image (Optional)</Text>
        <Text style={[s.hint, { color: C.textMuted }]}>Upload a photo of the item for the deliveryman</Text>

        <View style={s.imageUploadRow}>
          {parcelImageUrl ? (
            <View style={s.imagePreviewWrap}>
              <Image source={{ uri: parcelImageUrl }} style={s.imagePreview} />
              <TouchableOpacity style={s.removeImage} onPress={() => onImageChange(null)}>
                <Ionicons name="close-circle" size={24} color="#EF4444" />
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <TouchableOpacity 
                style={[s.uploadBox, { backgroundColor: C.surface, borderColor: C.border }]} 
                onPress={() => pickImage(false)}
                disabled={uploading}
              >
                {uploading ? (
                  <ActivityIndicator color={Colors.brand.primary} />
                ) : (
                  <>
                    <Ionicons name="images-outline" size={24} color={C.textMuted} />
                    <Text style={[s.uploadBoxTxt, { color: C.textMuted }]}>Gallery</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity 
                style={[s.uploadBox, { backgroundColor: C.surface, borderColor: C.border }]} 
                onPress={() => pickImage(true)}
                disabled={uploading}
              >
                {uploading ? (
                  <ActivityIndicator color={Colors.brand.primary} />
                ) : (
                  <>
                    <Ionicons name="camera-outline" size={24} color={C.textMuted} />
                    <Text style={[s.uploadBoxTxt, { color: C.textMuted }]}>Camera</Text>
                  </>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      {/* Terms Agreement */}
      <View style={s.termsSection}>
        <TouchableOpacity 
          style={s.termsRow} 
          activeOpacity={0.7} 
          onPress={() => onTermsChange(!termsAccepted)}
        >
          <View style={[s.checkbox, { 
            borderColor: termsAccepted ? Colors.brand.primary : C.border,
            backgroundColor: termsAccepted ? Colors.brand.primary : 'transparent'
          }]}>
            {termsAccepted && <Ionicons name="checkmark" size={14} color="#fff" />}
          </View>
          <Text style={[s.termsText, { color: C.textSecondary }]}>
            Parcel must not contain illegal or forbidden items under Terms of Use.
          </Text>
        </TouchableOpacity>
      </View>

      <View style={{ flex: 1 }} />

      <TouchableOpacity 
        activeOpacity={0.85} 
        disabled={!valid} 
        onPress={onSave}
        style={{ marginBottom: Math.max(insets.bottom, 16) }}
      >
        <LinearGradient
          colors={valid ? [Colors.brand.primary, Colors.brand.primaryLight] : [C.surfaceAlt, C.surfaceAlt]}
          style={s.saveBtn}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          <Text style={[s.saveBtnTxt, { color: valid ? '#fff' : C.textMuted }]}>Save Details</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20 },
  typeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 24,
  },
  typeIcon: { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  typeLabel: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  typeDesc: { fontSize: 12, fontWeight: '500' },
  weightSection: { marginBottom: 20 },
  sectionTitle: { fontSize: 17, fontWeight: '800', letterSpacing: -0.3, marginBottom: 4 },
  hint: { fontSize: 12, fontWeight: '500', marginBottom: 12 },
  weightInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    height: 56,
    marginBottom: 12,
  },
  weightInput: { flex: 1, fontSize: 20, fontWeight: '700' },
  unitBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8 },
  unitTxt: { fontSize: 13, fontWeight: '800' },
  presets: { flexDirection: 'row', gap: 8 },
  preset: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
  presetTxt: { fontSize: 12, fontWeight: '700' },
  
  imageSection: { marginTop: 8 },
  imageUploadRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
  uploadBox: {
    flex: 1,
    height: 80,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  uploadBoxTxt: { fontSize: 11, fontWeight: '600' },
  imagePreviewWrap: { width: 100, height: 100, borderRadius: 12, overflow: 'hidden', position: 'relative' },
  imagePreview: { width: '100%', height: '100%' },
  removeImage: { position: 'absolute', top: 4, right: 4 },

  termsSection: { marginTop: 24, marginBottom: 16 },
  termsRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  checkbox: { 
    width: 20, 
    height: 20, 
    borderRadius: 4, 
    borderWidth: 1.5, 
    alignItems: 'center', 
    justifyContent: 'center',
    marginTop: 2,
  },
  termsText: { fontSize: 12, lineHeight: 18, flex: 1, fontWeight: '500' },

  saveBtn: { paddingVertical: 17, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  saveBtnTxt: { fontSize: 16, fontWeight: '800' },
});
