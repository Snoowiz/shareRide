import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
  Animated, Dimensions, Image
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth, emptyDriverSignup, DriverSignupData } from '@/context/AuthContext';
import { useAppContext } from '@/context/AppContext';
import { Colors } from '@/constants/Colors';
import * as ImagePicker from 'expo-image-picker';
import PhoneInput from '@/components/PhoneInput';
import { uploadImage } from '@/lib/storage';
import AlertModal from '@/components/AlertModal';
import DateTimePicker from '@react-native-community/datetimepicker';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STEP_STORAGE_KEY = '@goride_driver_signup_step';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TOTAL_STEPS = 6;

const VEHICLE_TYPES = [
  { id: 'car', label: 'Car Driver', icon: 'car-sport', desc: 'Ride-sharing' },
  { id: 'motorbike', label: 'Bike Courier', icon: 'bicycle', desc: 'Delivery' },
] as const;

const GENDER_OPTIONS = [
  { id: 'male', label: 'Male' },
  { id: 'female', label: 'Female' },
  { id: 'other', label: 'Other' },
] as const;

export default function DriverSignupScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ phone?: string; email?: string; startStep?: string; step?: string }>();
  const { colorScheme } = useAppContext();
  const { signUpWithEmail, saveDriverProfile, authUser, setSelectedRole, driverSignupData, setDriverSignupData, signOut } = useAuth();
  const C = Colors[colorScheme];
  const isDark = colorScheme === 'dark';
  const accent = Colors.brand.secondary;

  const [step, setStep] = useState(1);

  // Load step and data
  useEffect(() => {
    const loadState = async () => {
      const savedStep = await AsyncStorage.getItem(STEP_STORAGE_KEY);
      if (savedStep) {
        const pStep = parseInt(savedStep);
        // Only jump to saved step if we're not explicitly given one in params
        if (!params.step && !params.startStep) {
           setStep(pStep);
           // Also update URL to reflect the step for back button support
           router.setParams({ step: pStep.toString() });
        }
      }
    };
    loadState();
  }, []);

  // Persist step when it changes
  useEffect(() => {
    AsyncStorage.setItem(STEP_STORAGE_KEY, step.toString());
  }, [step]);

  // Sync step with URL params for native back support
  React.useEffect(() => {
    if (params.step) {
      const pStep = parseInt(params.step);
      if (pStep !== step) setStep(pStep);
    }
  }, [params.step]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [alertConfig, setAlertConfig] = useState<{
    visible: boolean;
    title: string;
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
    onConfirm?: () => void;
    showCancel?: boolean;
    confirmText?: string;
    cancelText?: string;
    onCancel?: () => void;
  }>({
    visible: false,
    title: '',
    message: '',
    type: 'info',
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showGenderPicker, setShowGenderPicker] = useState(false);
  const [manualAddress, setManualAddress] = useState(false);

  const progressAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const data = driverSignupData;
  const update = (fields: Partial<DriverSignupData>) => {
    setDriverSignupData((prev) => ({ ...prev, ...fields }));
  };

  const GOOGLE_MAPS_APIKEY = Constants.expoConfig?.extra?.EXPO_PUBLIC_GOOGLE_MAPS_APIKEY || process.env.EXPO_PUBLIC_GOOGLE_MAPS_APIKEY;

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      const formatted = selectedDate.toISOString().split('T')[0];
      update({ dateOfBirth: formatted });
    }
  };

  // Initialize phone from params
  React.useEffect(() => {
    if (params.phone && !data.phone) update({ phone: params.phone });
    if (params.email && !data.email) update({ email: params.email });
  }, []);

  const animateStep = (next: number) => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 100, useNativeDriver: true }).start(() => {
      // Use router.push to create a new history entry for the step
      // This enables native swipe-back to previous step
      router.push({ 
        pathname: '/(auth)/driver-signup', 
        params: { ...params, step: next.toString() } 
      });
      Animated.timing(progressAnim, { toValue: next, duration: 300, useNativeDriver: false }).start();
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    });
  };

  const validateStep = (): boolean => {
    const e: Record<string, string> = {};
    switch (step) {
      case 1:
        if (!data.driverType) e.driverType = 'Select a vehicle type';
        break;
      case 2:
        if (!data.firstName.trim()) e.firstName = 'Required';
        if (!data.lastName.trim()) e.lastName = 'Required';
        if (!data.dateOfBirth.trim()) e.dateOfBirth = 'Required';
        if (!data.gender) e.gender = 'Required';
        if (!data.phone.trim()) e.phone = 'Required';
        if (!data.email.trim()) e.email = 'Required';
        if (!/^\S+@\S+\.\S+$/.test(data.email)) e.email = 'Invalid email';
        if (!authUser) {
          if (!data.password?.trim()) e.password = 'Required';
          if (data.password && data.password.length < 6) e.password = 'Min 6 characters';
          if (data.password !== data.confirmPassword) e.confirmPassword = 'Passwords do not match';
        }
        break;
      case 3:
        // Document uploads — relaxed for now (mocked)
        break;
      case 4:
        if (!data.vehicleYear.trim()) e.vehicleYear = 'Required';
        if (!data.vehicleMake.trim()) e.vehicleMake = 'Required';
        if (!data.licensePlate.trim()) e.licensePlate = 'Required';
        if (!data.vehicleColor.trim()) e.vehicleColor = 'Required';
        break;
      case 5:
        if (!data.residentialAddress.trim()) e.residentialAddress = 'Required';
        if (!data.bankName.trim()) e.bankName = 'Required';
        if (!data.accountNumber.trim()) e.accountNumber = 'Required';
        if (!data.accountName.trim()) e.accountName = 'Required';
        if (!data.nextOfKinName.trim()) e.nextOfKinName = 'Required';
        if (!data.nextOfKinPhone.trim()) e.nextOfKinPhone = 'Required';
        break;
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleNext = async () => {
    if (!validateStep()) return;
    
    if (step === 2 && !authUser) {
      setLoading(true);
      const result = await signUpWithEmail(data.email, data.password!, {
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        role: 'driver',
      });
      
      setLoading(false);
      if (result.error) {
        setAlertConfig({
          visible: true,
          title: 'Signup Failed',
          message: result.error,
          type: 'error'
        });
        return;
      }

      setAlertConfig({
        visible: true,
        title: "You're halfway in!",
        message: 'Your account has been created successfully! Just a few more steps to verify your driver profile and start earning.',
        type: 'success',
        onConfirm: () => {
          setAlertConfig(prev => ({ ...prev, visible: false }));
          animateStep(step + 1);
        }
      });
      return;
    }

    if (step < TOTAL_STEPS) {
      animateStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      animateStep(step - 1);
    } else {
      // Can't go back if we were redirected here — navigate to role selection instead
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/');
      }
    }
  };

  const handleComplete = async () => {
    setLoading(true);

    // Save driver profile and finalize registration
    const result = await saveDriverProfile(data);
    setLoading(false);
    if (result.error) {
      setAlertConfig({
        visible: true,
        title: 'Error',
        message: result.error,
        type: 'error'
      });
      return;
    }

    await setSelectedRole('driver');
    await AsyncStorage.removeItem(STEP_STORAGE_KEY);
    setDriverSignupData(emptyDriverSignup);
    router.replace('/(driver)/(tabs)');
  };

  const pickImage = async (field: keyof DriverSignupData) => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: field.toLowerCase().includes('photo') ? [1, 1] : [16, 9],
        quality: 0.7,
      });

      if (!result.canceled && result.assets && result.assets[0].uri) {
        setLoading(true);
        const uri = result.assets[0].uri;
        const extension = uri.split('.').pop();
        const folder = field.toLowerCase().includes('vehicle') ? 'vehicles' : 'identity';
        const path = `signup/${folder}/${Date.now()}.${extension}`;
        
        // Use 'driver-docs' bucket
        const publicUrl = await uploadImage('driver-docs', path, uri);
        
        update({ [field]: publicUrl } as any);
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

  // ── Shared input builder ──
  const renderInput = (
    label: string,
    value: string,
    onChange: (t: string) => void,
    icon: string,
    opts: { placeholder?: string; keyboardType?: TextInput['props']['keyboardType']; error?: string; autoCapitalize?: TextInput['props']['autoCapitalize']; onTouch?: () => void } = {}
  ) => (
    <View style={st.inputGroup}>
      <Text style={[st.inputLabel, { color: C.textSecondary }]}>{label}</Text>
      <TouchableOpacity 
        activeOpacity={opts.onTouch ? 0.7 : 1}
        onPress={opts.onTouch}
        style={[st.inputWrap, { backgroundColor: C.surface, borderColor: opts.error ? Colors.brand.danger : C.border }]}
      >
        <Ionicons name={icon as any} size={20} color={C.textMuted} style={{ marginRight: 12 }} />
        <TextInput
          style={[st.input, { color: C.text }]}
          placeholder={opts.placeholder}
          placeholderTextColor={C.textMuted}
          value={value}
          onChangeText={onChange}
          keyboardType={opts.keyboardType}
          autoCapitalize={opts.autoCapitalize ?? 'words'}
          editable={!opts.onTouch}
          pointerEvents={opts.onTouch ? 'none' : 'auto'}
        />
        {opts.onTouch && <Ionicons name="chevron-down" size={18} color={C.textMuted} />}
      </TouchableOpacity>
      {opts.error ? <Text style={st.errorTxt}>{opts.error}</Text> : null}
    </View>
  );

  const renderDocCard = (label: string, field: keyof DriverSignupData, description: string, icon: string, required: boolean = true) => {
    const value = data[field] as string;
    return (
      <View style={st.docCard}>
        <View style={st.docInfo}>
          <View style={[st.docIcon, { backgroundColor: accent + '15' }]}>
            <Ionicons name={icon as any} size={22} color={accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[st.docLabel, { color: C.text }]}>{label} {required && <Text style={{ color: Colors.brand.danger }}>*</Text>}</Text>
            <Text style={[st.docStatus, { color: value ? Colors.brand.primary : C.textMuted }]}>
              {value ? 'Selected • Reviewing' : 'Required'}
            </Text>
          </View>
          <TouchableOpacity 
            style={[st.updateBtn, { backgroundColor: C.surfaceAlt }]} 
            onPress={() => pickImage(field)}
          >
            <Text style={[st.updateBtnTxt, { color: C.text }]}>{value ? 'Change' : 'Upload'}</Text>
          </TouchableOpacity>
        </View>
        {value ? (
          <View style={[st.previewWrap, { borderColor: C.border }]}>
             <Image source={{ uri: value }} style={st.previewImg} />
             <TouchableOpacity style={st.removeImg} onPress={() => update({ [field]: '' } as any)}>
                <Ionicons name="close-circle" size={24} color={Colors.brand.danger} />
             </TouchableOpacity>
          </View>
        ) : (
          <Text style={[st.docDesc, { color: C.textSecondary }]}>{description}</Text>
        )}
      </View>
    );
  };

  // ── Step renderers ──
  const renderStep1 = () => (
    <View>
      <Text style={[st.stepTitle, { color: C.text }]}>What do you drive?</Text>
      <Text style={[st.stepDesc, { color: C.textSecondary }]}>Select the type of vehicle you will use</Text>
      <View style={[st.vehicleGrid, { flexDirection: 'row' }]}>
        {VEHICLE_TYPES.map((v) => {
          const selected = data.driverType === v.id;
          return (
            <TouchableOpacity
              key={v.id}
              style={[st.vehicleCard, {
                backgroundColor: selected ? accent + '15' : C.surface,
                borderColor: selected ? accent : C.border,
                flex: 1,
              }]}
              onPress={() => { update({ driverType: v.id, vehicleType: v.id === 'car' ? 'Car' : 'Motorcycle' }); setErrors({}); }}
              activeOpacity={0.8}
            >
              {selected && (
                <View style={st.vehicleCheck}>
                  <Ionicons name="checkmark-circle" size={22} color={accent} />
                </View>
              )}
              <LinearGradient
                colors={selected ? [accent, Colors.brand.secondaryLight] : [C.surfaceAlt, C.surfaceAlt]}
                style={st.vehicleIconWrap}
              >
                <Ionicons name={v.icon as any} size={32} color={selected ? '#000' : C.icon} />
              </LinearGradient>
              <Text style={[st.vehicleName, { color: C.text }]}>{v.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {errors.driverType ? <Text style={[st.errorTxt, { textAlign: 'center' }]}>{errors.driverType}</Text> : null}
    </View>
  );

  const renderStep2 = () => (
    <View>
      <Text style={[st.stepTitle, { color: C.text }]}>Personal Information</Text>
      <Text style={[st.stepDesc, { color: C.textSecondary }]}>Tell us a bit about yourself</Text>

      <View style={st.nameRow}>
        <View style={{ flex: 1 }}>
          {renderInput('First Name', data.firstName, (t) => update({ firstName: t }), 'person-outline', { placeholder: 'John', error: errors.firstName })}
        </View>
        <View style={{ flex: 1 }}>
          {renderInput('Last Name', data.lastName, (t) => update({ lastName: t }), 'person-outline', { placeholder: 'Doe', error: errors.lastName })}
        </View>
      </View>
 
      <View style={st.nameRow}>
        <View style={{ flex: 1 }}>
          {renderInput('Date of Birth', data.dateOfBirth, (t) => update({ dateOfBirth: t }), 'calendar-outline', { placeholder: 'Select Date', error: errors.dateOfBirth, onTouch: () => setShowDatePicker(true) })}
        </View>
        <View style={{ flex: 1 }}>
          {renderInput('Gender', data.gender ? GENDER_OPTIONS.find(g => g.id === data.gender)?.label || data.gender : '', (t) => update({ gender: t as any }), 'male-female-outline', { placeholder: 'Select', error: errors.gender, onTouch: () => setShowGenderPicker(true) })}
        </View>
      </View>
 
      {showDatePicker && (
        <DateTimePicker
          value={data.dateOfBirth ? new Date(data.dateOfBirth) : new Date(2000, 0, 1)}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={onDateChange}
          maximumDate={new Date()}
        />
      )}

      <View style={st.inputGroup}>
        <Text style={[st.inputLabel, { color: C.textSecondary }]}>Phone Number</Text>
        <PhoneInput
          value={data.phone}
          onChangeText={(t) => { update({ phone: t }); setErrors(prev => ({ ...prev, phone: '' })); }}
          error={errors.phone}
          isDriver={true}
        />
      </View>

      {renderInput('Email Address', data.email, (t) => update({ email: t }), 'mail-outline', { 
        placeholder: 'john@example.com', 
        keyboardType: 'email-address',
        autoCapitalize: 'none',
        error: errors.email 
      })}

      {!authUser && (
        <>
          <View style={st.inputGroup}>
            <Text style={[st.inputLabel, { color: C.textSecondary }]}>Password</Text>
            <View style={[st.inputWrap, { backgroundColor: C.surface, borderColor: errors.password ? Colors.brand.danger : C.border }]}>
              <Ionicons name="lock-closed-outline" size={20} color={C.textMuted} style={{ marginRight: 12 }} />
              <TextInput
                style={[st.input, { color: C.text }]}
                value={data.password}
                onChangeText={(t) => update({ password: t })}
                placeholder="••••••••"
                placeholderTextColor={C.textMuted}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Ionicons name={showPassword ? "eye-outline" : "eye-off-outline"} size={20} color={C.textMuted} />
              </TouchableOpacity>
            </View>
            {errors.password ? <Text style={st.errorTxt}>{errors.password}</Text> : null}
          </View>

          <View style={st.inputGroup}>
            <Text style={[st.inputLabel, { color: C.textSecondary }]}>Confirm Password</Text>
            <View style={[st.inputWrap, { backgroundColor: C.surface, borderColor: errors.confirmPassword ? Colors.brand.danger : C.border }]}>
              <Ionicons name="lock-closed-outline" size={20} color={C.textMuted} style={{ marginRight: 12 }} />
              <TextInput
                style={[st.input, { color: C.text }]}
                value={data.confirmPassword}
                onChangeText={(t) => update({ confirmPassword: t })}
                placeholder="••••••••"
                placeholderTextColor={C.textMuted}
                secureTextEntry={!showConfirmPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                <Ionicons name={showConfirmPassword ? "eye-outline" : "eye-off-outline"} size={20} color={C.textMuted} />
              </TouchableOpacity>
            </View>
            {errors.confirmPassword ? <Text style={st.errorTxt}>{errors.confirmPassword}</Text> : null}
          </View>
        </>
      )}
    </View>
  );

  const renderStep3 = () => (
    <View>
      <Text style={[st.stepTitle, { color: C.text }]}>Driver Verification</Text>
      <Text style={[st.stepDesc, { color: C.textSecondary }]}>Enter your license details and upload documents</Text>
      
      {renderInput("Driver's License Number", data.licenseNumber, (t) => update({ licenseNumber: t }), 'card-outline', { placeholder: 'ABC123456789', autoCapitalize: 'characters' })}
      
      <View style={[st.divider, { backgroundColor: C.border, marginVertical: 12 }]} />
      
      <View style={st.uploadsCol}>
        {renderDocCard("Driver's License", 'driversLicenseUri', "Upload a clear picture of your license.", 'card-outline')}
        {renderDocCard('Profile Photo', 'profilePhotoUri', "Take a clear portrait picture (not a full body picture) of yourself. It should show your full face, front view, with eyes open.", 'camera-outline')}
        {renderDocCard('NIN Slip', 'ninSlipUri', "Upload your National Identity Number slip.", 'document-text-outline')}
      </View>
    </View>
  );

  const renderStep4 = () => (
    <View>
      <Text style={[st.stepTitle, { color: C.text }]}>Vehicle Information</Text>
      <Text style={[st.stepDesc, { color: C.textSecondary }]}>Provide details about your vehicle</Text>
 
      <View style={st.nameRow}>
        <View style={{ flex: 1 }}>
          {renderInput('Vehicle Year', data.vehicleYear, (t) => update({ vehicleYear: t }), 'calendar-outline', { placeholder: '2023', keyboardType: 'number-pad', error: errors.vehicleYear })}
        </View>
        <View style={{ flex: 1 }}>
          {renderInput('Vehicle Color', data.vehicleColor, (t) => update({ vehicleColor: t }), 'color-palette-outline', { placeholder: 'Black', error: errors.vehicleColor })}
        </View>
      </View>
 
      {renderInput('Make / Model', data.vehicleMake, (t) => update({ vehicleMake: t }), 'car-outline', { placeholder: 'Toyota Camry', error: errors.vehicleMake })}
      {renderInput('License Plate', data.licensePlate, (t) => update({ licensePlate: t }), 'pricetag-outline', { placeholder: 'ABC-123-XY', autoCapitalize: 'characters', error: errors.licensePlate })}
 
      <View style={st.uploadsCol}>
        {renderDocCard('Vehicle Particulars', 'vehicleParticularsUri', "Upload a clear picture of your vehicle's particular, ensuring the informations is fully visible.", 'document-attach-outline')}
        {renderDocCard('Vehicle Exterior Photo', 'vehicleExteriorUri', "Upload a clear picture of your vehicle's exterior, ensuring the plate number is fully visible.", 'image-outline')}
      </View>
    </View>
  );

  const renderStep5 = () => (
    <View>
      <Text style={[st.stepTitle, { color: C.text }]}>Payment & Emergency</Text>
      <Text style={[st.stepDesc, { color: C.textSecondary }]}>Banking and next of kin details</Text>
 
      <View style={st.inputGroup}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <Text style={[st.inputLabel, { color: C.textSecondary, marginBottom: 0 }]}>Residential Address</Text>
          <TouchableOpacity onPress={() => setManualAddress(!manualAddress)}>
            <Text style={{ fontSize: 12, color: accent, fontWeight: '600' }}>
              {manualAddress ? 'Use Search' : 'Type Manually'}
            </Text>
          </TouchableOpacity>
        </View>
        
        {manualAddress ? (
          <View style={[st.inputWrap, { backgroundColor: C.surface, borderColor: errors.residentialAddress ? Colors.brand.danger : C.border }]}>
            <Ionicons name="home-outline" size={20} color={C.textMuted} style={{ marginRight: 12 }} />
            <TextInput
              style={[st.input, { color: C.text }]}
              value={data.residentialAddress}
              onChangeText={(t) => update({ residentialAddress: t })}
              placeholder="123 Main St, Lagos"
              placeholderTextColor={C.textMuted}
            />
          </View>
        ) : (
          <GooglePlacesAutocomplete
            placeholder='Search address...'
            onPress={(addrData, details = null) => {
              update({ residentialAddress: addrData.description });
            }}
            query={{
              key: GOOGLE_MAPS_APIKEY,
              language: 'en',
            }}
            styles={{
              container: { flex: 0 },
              textInput: [st.input, { color: C.text, backgroundColor: C.surface, height: 50, borderRadius: 12, borderWidth: 1.5, borderColor: C.border, paddingHorizontal: 16 }],
              listView: { backgroundColor: C.surface, borderRadius: 12, marginTop: 4, elevation: 3, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4 },
              row: { padding: 13, height: 44, flexDirection: 'row' },
              description: { color: C.text },
            }}
            onFail={(error) => console.error(error)}
            textInputProps={{
              placeholderTextColor: C.textMuted,
              value: data.residentialAddress,
              onChangeText: (t) => update({ residentialAddress: t }),
            }}
          />
        )}
        {errors.residentialAddress ? <Text style={st.errorTxt}>{errors.residentialAddress}</Text> : null}
      </View>

      <Text style={[st.groupHeader, { color: C.text }]}>Bank Information</Text>
      {renderInput('Bank Name', data.bankName, (t) => update({ bankName: t }), 'business-outline', { placeholder: 'First Bank', error: errors.bankName })}
      <View style={st.nameRow}>
        <View style={{ flex: 1 }}>
          {renderInput('Account No.', data.accountNumber, (t) => update({ accountNumber: t }), 'keypad-outline', { placeholder: '0123456789', keyboardType: 'number-pad', error: errors.accountNumber })}
        </View>
        <View style={{ flex: 1 }}>
          {renderInput('Account Name', data.accountName, (t) => update({ accountName: t }), 'person-outline', { placeholder: 'John Doe', error: errors.accountName })}
        </View>
      </View>

      <Text style={[st.groupHeader, { color: C.text }]}>Next of Kin</Text>
      {renderInput('Full Name', data.nextOfKinName, (t) => update({ nextOfKinName: t }), 'people-outline', { placeholder: 'Jane Doe', error: errors.nextOfKinName })}
      <View style={st.nameRow}>
        <View style={{ flex: 1 }}>
          <Text style={[st.inputLabel, { color: C.textSecondary }]}>Phone</Text>
          <PhoneInput
            value={data.nextOfKinPhone}
            onChangeText={(t) => { update({ nextOfKinPhone: t }); setErrors(prev => ({ ...prev, nextOfKinPhone: '' })); }}
            error={errors.nextOfKinPhone}
            isDriver={true}
          />
        </View>
        <View style={{ flex: 1 }}>
          {renderInput('Relationship', data.nextOfKinRelationship, (t) => update({ nextOfKinRelationship: t }), 'heart-outline', { placeholder: 'Sibling' })}
        </View>
      </View>
    </View>
  );

  const renderStep6 = () => (
    <View style={st.confirmationWrap}>
      <LinearGradient colors={[accent, Colors.brand.secondaryLight]} style={st.confirmCircle}>
        <Ionicons name="shield-checkmark" size={56} color="#000" />
      </LinearGradient>
      <Text style={[st.confirmTitle, { color: C.text }]}>Application Submitted!</Text>
      <Text style={[st.confirmDesc, { color: C.textSecondary }]}>
        Your driver application is under review. Our team will verify your documents within 24–48 hours. You can start exploring the app while we process your application.
      </Text>

      <View style={[st.confirmCard, { backgroundColor: C.surface, borderColor: C.border }]}>
        <View style={st.confirmRow}>
          <Ionicons name="person" size={18} color={accent} />
          <Text style={[st.confirmRowTxt, { color: C.text }]}>{data.firstName} {data.lastName}</Text>
        </View>
        <View style={[st.confirmDivider, { backgroundColor: C.border }]} />
        <View style={st.confirmRow}>
          <Ionicons name="car" size={18} color={accent} />
          <Text style={[st.confirmRowTxt, { color: C.text }]}>{data.vehicleMake || 'N/A'} — {data.vehicleColor || 'N/A'}</Text>
        </View>
        <View style={[st.confirmDivider, { backgroundColor: C.border }]} />
        <View style={st.confirmRow}>
          <Ionicons name="call" size={18} color={accent} />
          <Text style={[st.confirmRowTxt, { color: C.text }]}>{data.phone}</Text>
        </View>
      </View>

      <View style={[st.statusBadge, { backgroundColor: accent + '20' }]}>
        <Ionicons name="time" size={16} color={accent} />
        <Text style={[st.statusTxt, { color: accent }]}>Verification Pending</Text>
      </View>
    </View>
  );

  const stepRenderers = [renderStep1, renderStep2, renderStep3, renderStep4, renderStep5, renderStep6];

  const progressWidth = progressAnim.interpolate({
    inputRange: [1, TOTAL_STEPS],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={[st.root, { backgroundColor: C.background }]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 20}>
        {/* Top Bar */}
        <View style={[st.topBar, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={handleBack} style={st.backBtn} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={24} color={C.text} />
          </TouchableOpacity>
          <View style={{ flex: 1, marginHorizontal: 16 }}>
            <View style={[st.progressTrack, { backgroundColor: C.surfaceAlt }]}>
              <Animated.View style={[st.progressFill, { width: progressWidth, backgroundColor: accent }]} />
            </View>
            <Text style={[st.stepIndicator, { color: C.textMuted }]}>Step {step} of {TOTAL_STEPS}</Text>
          </View>
          {step < TOTAL_STEPS && (
            <TouchableOpacity onPress={() => {
              setAlertConfig({
                visible: true,
                title: 'Cancel Registration?',
                message: 'All your progress will be lost and your current session will be closed. Are you sure you want to exit?',
                type: 'warning',
                showCancel: true,
                confirmText: 'Yes, Exit',
                onConfirm: async () => {
                  setAlertConfig(prev => ({ ...prev, visible: false }));
                  // Destroy session and clear all registration data
                  await signOut();
                  await AsyncStorage.removeItem(STEP_STORAGE_KEY);
                  router.replace('/');
                }
              });
            }}>
              <Text style={[st.cancelTxt, { color: C.textMuted }]}>Cancel</Text>
            </TouchableOpacity>
          )}
        </View>

        <ScrollView
          contentContainerStyle={[st.scrollContent, { paddingBottom: insets.bottom + 120 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          automaticallyAdjustKeyboardInsets={true}
        >
          <Animated.View style={{ opacity: fadeAnim }}>
            {stepRenderers[step - 1]()}
          </Animated.View>
        </ScrollView>

        {/* Bottom Action */}
        <View style={[st.bottomBar, { paddingBottom: insets.bottom + 16, backgroundColor: C.background }]}>
          {step < TOTAL_STEPS ? (
            <TouchableOpacity
              style={[st.primaryBtn, { backgroundColor: accent }]}
              activeOpacity={0.85}
              onPress={handleNext}
            >
              <Text style={[st.primaryBtnTxt, { color: '#000' }]}>
                {step === TOTAL_STEPS - 1 ? 'Submit Application' : 'Continue'}
              </Text>
              <Ionicons name="arrow-forward" size={20} color="#000" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[st.primaryBtn, { backgroundColor: accent }]}
              activeOpacity={0.85}
              onPress={handleComplete}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#000" />
              ) : (
                <>
                  <Text style={[st.primaryBtnTxt, { color: '#000' }]}>Open App</Text>
                  <Ionicons name="arrow-forward" size={20} color="#000" />
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>

      <AlertModal
        isVisible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        confirmText={alertConfig.confirmText}
        onConfirm={alertConfig.onConfirm}
        cancelText={alertConfig.cancelText}
        onCancel={alertConfig.onCancel}
        showCancel={alertConfig.showCancel}
        onClose={() => setAlertConfig(prev => ({ ...prev, visible: false }))}
      />

      {showGenderPicker && (
        <TouchableOpacity 
          style={st.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setShowGenderPicker(false)}
        >
          <View style={[st.pickerModal, { backgroundColor: C.surface }]}>
            <Text style={[st.pickerTitle, { color: C.text }]}>Select Gender</Text>
            {GENDER_OPTIONS.map((g) => (
              <TouchableOpacity 
                key={g.id} 
                style={st.pickerItem}
                onPress={() => { update({ gender: g.id }); setShowGenderPicker(false); setErrors(prev => ({ ...prev, gender: '' })); }}
              >
                <Text style={[st.pickerItemTxt, { color: C.text }]}>{g.label}</Text>
                {data.gender === g.id && <Ionicons name="checkmark" size={20} color={accent} />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1 },
  // ... rest of st styles
  modalOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  pickerModal: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  pickerTitle: { fontSize: 18, fontWeight: '800', marginBottom: 20, textAlign: 'center' },
  pickerItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(0,0,0,0.1)' },
  pickerItemTxt: { fontSize: 16, fontWeight: '600' },
  topBar: { paddingHorizontal: 20, paddingBottom: 12, flexDirection: 'row', alignItems: 'center' },
  backBtn: { width: 44, height: 44, justifyContent: 'center' },
  progressTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  stepIndicator: { fontSize: 12, fontWeight: '600', marginTop: 6, textAlign: 'center' },
  cancelTxt: { fontSize: 14, fontWeight: '600' },

  scrollContent: { paddingHorizontal: 24, paddingTop: 8 },

  stepTitle: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5, marginBottom: 8 },
  stepDesc: { fontSize: 15, fontWeight: '500', lineHeight: 22, marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginTop: 12, marginBottom: 12 },

  // Shared input styles
  inputGroup: { marginBottom: 16 },
  inputLabel: { fontSize: 13, fontWeight: '600', marginBottom: 8, marginLeft: 4 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1.5, paddingHorizontal: 16, height: 56 },
  input: { flex: 1, fontSize: 16, fontWeight: '500' },
  errorTxt: { color: '#E53935', fontSize: 12, fontWeight: '500', marginTop: 4, marginLeft: 4 },
  nameRow: { flexDirection: 'row', gap: 12 },

  // Step 1
  vehicleGrid: { gap: 12 },
  vehicleCard: {
    borderRadius: 12,
    borderWidth: 2,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    position: 'relative',
  },
  vehicleCheck: { position: 'absolute', top: 12, right: 12 },
  vehicleIconWrap: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  vehicleName: { fontSize: 17, fontWeight: '800' },
  vehicleDesc: { fontSize: 13, marginTop: 2 },

  // Step 2
  genderRow: { flexDirection: 'row', gap: 10 },
  genderChip: { flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  genderTxt: { fontSize: 14, fontWeight: '700' },

  // Doc Card Styles
  uploadsCol: { gap: 16, marginTop: 8 },
  docCard: { borderRadius: 12, marginBottom: 8 },
  docInfo: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 8 },
  docIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  docLabel: { fontSize: 16, fontWeight: '700' },
  docStatus: { fontSize: 13, marginTop: 1 },
  docDesc: { fontSize: 13, lineHeight: 18, marginLeft: 58 },
  updateBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  updateBtnTxt: { fontSize: 13, fontWeight: '600' },
  previewWrap: { height: 160, borderRadius: 12, borderWidth: 1, overflow: 'hidden', position: 'relative', marginTop: 8 },
  previewImg: { width: '100%', height: '100%' },
  removeImg: { position: 'absolute', top: 8, right: 8, backgroundColor: '#fff', borderRadius: 12 },
  divider: { height: 1, width: '100%', marginVertical: 8 },

  // Step 5
  groupHeader: { fontSize: 16, fontWeight: '700', marginTop: 8, marginBottom: 12 },

  // Step 6 confirmation
  confirmationWrap: { alignItems: 'center', paddingTop: 20 },
  confirmCircle: { width: 110, height: 110, borderRadius: 55, alignItems: 'center', justifyContent: 'center', marginBottom: 28 },
  confirmTitle: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5, marginBottom: 12 },
  confirmDesc: { fontSize: 15, fontWeight: '500', textAlign: 'center', lineHeight: 24, paddingHorizontal: 12, marginBottom: 28 },
  confirmCard: { width: '100%', borderRadius: 12, borderWidth: 1, overflow: 'hidden', marginBottom: 20 },
  confirmRow: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 },
  confirmRowTxt: { fontSize: 15, fontWeight: '600' },
  confirmDivider: { height: 1, marginLeft: 48 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 },
  statusTxt: { fontSize: 14, fontWeight: '700' },

  // Bottom
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  primaryBtn: {
    height: 56,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
  },
  primaryBtnTxt: { fontSize: 16, fontWeight: '800' },
});
