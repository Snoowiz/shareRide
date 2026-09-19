import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Image, ActivityIndicator, Dimensions, Platform, Animated
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import LottieView from 'lottie-react-native';
import { useAuth } from '@/context/AuthContext';
import { useAppContext } from '@/context/AppContext';
import { Colors } from '@/constants/Colors';
import { supabase } from '@/lib/supabase';
import AlertModal from '@/components/AlertModal';

const { width } = Dimensions.get('window');

type VerificationStep = 'intro' | 'select_id' | 'capture_front' | 'capture_back' | 'selfie' | 'face_matching' | 'review';
type IDType = 'nin' | 'passport' | 'voters_card' | 'identity_card';

function FaceMatchingStep({ selfieImage, C }: { selfieImage: string, C: any }) {
  const scanAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scanAnim, {
          toValue: 220,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(scanAnim, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  return (
    <View style={[s.stepContainer, { justifyContent: 'center', alignItems: 'center' }]}>
      <View style={s.scanningContainer}>
        <Image source={{ uri: selfieImage }} style={s.scanningImg} />
        <Animated.View
          style={[
            s.scanLine,
            { transform: [{ translateY: scanAnim }] }
          ]}
        />
        <LottieView
          source={require('@/assets/lottie/loading_sand.json')}
          autoPlay
          loop
          style={[StyleSheet.absoluteFill, { opacity: 0.3 }]}
        />
      </View>
      <Text style={[s.title, { color: C.text, marginTop: 32 }]}>Matching Face...</Text>
      <Text style={[s.subtitle, { color: C.textSecondary }]}>
        Comparing your selfie with your identity document. Please wait a moment.
      </Text>
      <ActivityIndicator size="large" color={Colors.brand.primary} />
    </View>
  );
}

export default function VerificationScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { authUser, updateAuthUser } = useAuth();
  const { colorScheme } = useAppContext();
  const C = Colors[colorScheme];

  const [step, setStep] = useState<VerificationStep>('intro');
  const [idType, setIdType] = useState<IDType | null>(null);
  const [frontImage, setFrontImage] = useState<string | null>(null);
  const [backImage, setBackImage] = useState<string | null>(null);
  const [selfieImage, setSelfieImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [alertConfig, setAlertConfig] = useState<{
    visible: boolean;
    title: string;
    message: string;
    type: 'success' | 'info' | 'warning' | 'error';
    onConfirm?: () => void;
    confirmText?: string;
    showCancel?: boolean;
  }>({
    visible: false,
    title: '',
    message: '',
    type: 'info',
  });

  // Profile completion check
  const isProfileComplete = !!(
    authUser?.firstName &&
    authUser?.lastName &&
    authUser?.email &&
    authUser?.phone &&
    authUser?.dateOfBirth &&
    authUser?.gender
  );

  const nextStep = () => {
    if (step === 'intro') setStep('select_id');
    else if (step === 'select_id') setStep('capture_front');
    else if (step === 'capture_front') {
      if (idType === 'voters_card' || idType === 'identity_card') setStep('capture_back');
      else setStep('selfie');
    }
    else if (step === 'capture_back') setStep('selfie');
    else if (step === 'selfie') {
      setStep('face_matching');
      // Simulate matching process
      setTimeout(() => setStep('review'), 3000);
    }
    else if (step === 'review') setStep('review'); // Handled by submit
  };

  const prevStep = () => {
    if (step === 'select_id') setStep('intro');
    else if (step === 'capture_front') setStep('select_id');
    else if (step === 'capture_back') setStep('capture_front');
    else if (step === 'selfie') {
      if (idType === 'voters_card' || idType === 'identity_card') setStep('capture_back');
      else setStep('capture_front');
    }
    else if (step === 'face_matching') setStep('selfie');
    else if (step === 'review') setStep('selfie');
  };

  const uploadDocument = async (uri: string, path: string) => {
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const arrayBuffer = await new Response(blob).arrayBuffer();

      const { error } = await supabase.storage
        .from('avatars') // Using avatars bucket as verified earlier
        .upload(path, arrayBuffer, {
          contentType: 'image/jpeg',
          upsert: true
        });

      if (error) throw error;

      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      return data.publicUrl;
    } catch (err) {
      console.error('Upload error:', err);
      throw err;
    }
  };

  const pickImage = async (type: 'front' | 'back' | 'selfie') => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      setAlertConfig({ visible: true, title: 'Permission Needed', message: 'We need camera access to verify your identity.', type: 'warning' });
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: type === 'selfie' ? [1, 1] : [16, 9],
      quality: 0.6,
      base64: true,
    });

    if (!result.canceled && result.assets[0].uri) {
      if (type === 'front') setFrontImage(result.assets[0].uri);
      else if (type === 'back') setBackImage(result.assets[0].uri);
      else setSelfieImage(result.assets[0].uri);
    }
  };

  const handleSubmit = async () => {
    if (!authUser) return;
    setLoading(true);

    try {
      const timestamp = Date.now();
      let frontUrl = '';
      let backUrl = '';
      let selfieUrl = '';

      // Upload images
      if (frontImage) {
        frontUrl = await uploadDocument(frontImage, `verification/${authUser.id}/id_front_${timestamp}.jpg`);
      }
      if (backImage) {
        backUrl = await uploadDocument(backImage, `verification/${authUser.id}/id_back_${timestamp}.jpg`);
      }
      if (selfieImage) {
        selfieUrl = await uploadDocument(selfieImage, `verification/${authUser.id}/selfie_${timestamp}.jpg`);
      }

      const { error } = await supabase
        .from('user_profiles')
        .upsert({
          id: authUser.id,
          verification_status: 'pending',
          id_type: idType,
          id_front_url: frontUrl,
          id_back_url: backUrl,
          selfie_url: selfieUrl,
          verified_at: null,
        });

      if (error) throw error;

      updateAuthUser({
        verificationStatus: 'pending',
        ninSlipUrl: frontUrl,
        idBackUrl: backUrl,
        selfieUrl: selfieUrl
      });

      setAlertConfig({
        visible: true,
        title: 'Verification Submitted',
        message: 'Your identity documents have been submitted successfully. We will review them within 24 hours.',
        type: 'success',
        onConfirm: () => {
          setAlertConfig({ ...alertConfig, visible: false });
          router.replace('/(user)/(tabs)/profile');
        }
      });
    } catch (err: any) {
      setAlertConfig({ visible: true, title: 'Submission Failed', message: err.message || 'Failed to submit verification. Please try again.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  if (!isProfileComplete) {
    return (
      <View style={[s.root, { backgroundColor: C.background, paddingTop: insets.top }]}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <Ionicons name="close" size={24} color={C.text} />
          </TouchableOpacity>
        </View>
        <View style={s.warningContent}>
          <View style={s.introIconWrap}>
            <Ionicons name="person-circle-outline" size={80} color={Colors.brand.primary} />
            <View style={s.warningBadge}>
               <Ionicons name="alert" size={16} color="#fff" />
            </View>
          </View>
          <Text style={[s.title, { color: C.text, marginTop: 24 }]}>Profile Incomplete</Text>
          <Text style={[s.subtitle, { color: C.textSecondary }]}>
            Before we can verify your identity, you need to complete your personal information including your date of birth and gender.
          </Text>
          
          <View style={s.missingInfoBox}>
             <Text style={[s.missingInfoTitle, { color: C.text }]}>Required Information:</Text>
             <View style={s.missingInfoList}>
                <View style={s.infoItemSmall}>
                   <Ionicons name="checkmark-circle" size={16} color={authUser?.firstName && authUser?.lastName ? Colors.brand.success : C.border} />
                   <Text style={[s.infoItemTxt, { color: C.textSecondary }]}>Full Name</Text>
                </View>
                <View style={s.infoItemSmall}>
                   <Ionicons name="checkmark-circle" size={16} color={authUser?.phone ? Colors.brand.success : C.border} />
                   <Text style={[s.infoItemTxt, { color: C.textSecondary }]}>Phone Number</Text>
                </View>
                <View style={s.infoItemSmall}>
                   <Ionicons name="checkmark-circle" size={16} color={authUser?.dateOfBirth ? Colors.brand.success : C.border} />
                   <Text style={[s.infoItemTxt, { color: C.textSecondary }]}>Date of Birth</Text>
                </View>
                <View style={s.infoItemSmall}>
                   <Ionicons name="checkmark-circle" size={16} color={authUser?.gender ? Colors.brand.success : C.border} />
                   <Text style={[s.infoItemTxt, { color: C.textSecondary }]}>Gender</Text>
                </View>
             </View>
          </View>

          <TouchableOpacity
            style={[s.actionBtn, { backgroundColor: Colors.brand.primary, width: '100%', marginTop: 40 }]}
            onPress={() => router.push('/(user)/edit-profile')}
          >
            <Text style={s.actionBtnTxt}>Go to Edit Profile</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (authUser?.verificationStatus === 'pending') {
    return (
      <View style={[s.root, { backgroundColor: C.background, paddingTop: insets.top }]}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <Ionicons name="close" size={24} color={C.text} />
          </TouchableOpacity>
        </View>
        <View style={[s.warningContent, { paddingBottom: insets.bottom + 20 }]}>
          <LottieView
            source={require('@/assets/lottie/loading_sand.json')}
            autoPlay
            loop
            style={{ width: 200, height: 200 }}
          />
          <Text style={[s.warningTitle, { color: C.text, marginTop: 20 }]}>Under Review</Text>
          <Text style={[s.warningSub, { color: C.textSecondary }]}>
            We're currently reviewing your documents. This usually takes less than 24 hours. You'll receive a notification once verified.
          </Text>

          <TouchableOpacity
            style={[s.actionBtn, { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, marginBottom: 12, width: '100%' }]}
            onPress={() => router.replace('/(user)/(tabs)/profile')}
          >
            <Text style={[s.actionBtnTxt, { color: C.text }]}>Back to Profile</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              updateAuthUser({ verificationStatus: 'unverified' });
              setStep('intro');
            }}
          >
            <Text style={{ color: Colors.brand.primary, fontWeight: '700' }}>Not sure? Retake Process</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const renderStep = () => {
    switch (step) {
      case 'intro':
        return (
          <View style={s.stepContainer}>
            <View style={s.introIconWrap}>
              <Ionicons name="shield-checkmark" size={100} color={Colors.brand.primary} />
            </View>
            <Text style={[s.title, { color: C.text }]}>Verify Your Identity</Text>
            <Text style={[s.subtitle, { color: C.textSecondary }]}>
              To ensure a safe community, we need to confirm your identity. This process is secure and only takes about 2 minutes.
            </Text>
            <View style={s.infoList}>
              <View style={s.infoItem}>
                <Ionicons name="shield-checkmark-outline" size={20} color={Colors.brand.primary} />
                <Text style={[s.infoText, { color: C.textSecondary }]}>Secure data encryption</Text>
              </View>
              <View style={s.infoItem}>
                <Ionicons name="time-outline" size={20} color={Colors.brand.primary} />
                <Text style={[s.infoText, { color: C.textSecondary }]}>Quick automated review</Text>
              </View>
            </View>
            <TouchableOpacity style={[s.actionBtn, { backgroundColor: Colors.brand.primary }]} onPress={nextStep}>
              <Text style={s.actionBtnTxt}>Get Started</Text>
            </TouchableOpacity>
          </View>
        );

      case 'select_id':
        return (
          <View style={s.stepContainer}>
            <Text style={[s.title, { color: C.text }]}>Select ID Type</Text>
            <Text style={[s.subtitle, { color: C.textSecondary }]}>
              Choose the document you'd like to use for verification.
            </Text>
            <View style={s.idList}>
              {[
                { id: 'nin', label: 'NIN Slip', icon: 'document-text' },
                { id: 'passport', label: 'International Passport', icon: 'airplane' },
                { id: 'voters_card', label: 'Voter\'s Card', icon: 'checkbox' },
                { id: 'identity_card', label: 'Government ID Card', icon: 'card' },
              ].map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    s.idItem,
                    { backgroundColor: C.surface, borderColor: idType === item.id ? Colors.brand.primary : C.border }
                  ]}
                  onPress={() => setIdType(item.id as IDType)}
                >
                  <Ionicons name={item.icon as any} size={24} color={idType === item.id ? Colors.brand.primary : C.icon} />
                  <Text style={[s.idLabel, { color: C.text }]}>{item.label}</Text>
                  {idType === item.id && <Ionicons name="checkmark-circle" size={20} color={Colors.brand.primary} />}
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={[s.actionBtn, { backgroundColor: idType ? Colors.brand.primary : C.border }]}
              disabled={!idType}
              onPress={nextStep}
            >
              <Text style={s.actionBtnTxt}>Continue</Text>
            </TouchableOpacity>
          </View>
        );

      case 'capture_front':
      case 'capture_back':
        const isFront = step === 'capture_front';
        const currentImg = isFront ? frontImage : backImage;
        return (
          <View style={s.stepContainer}>
            <Text style={[s.title, { color: C.text }]}>
              {isFront ? 'Front of Document' : 'Back of Document'}
            </Text>
            <Text style={[s.subtitle, { color: C.textSecondary }]}>
              {isFront
                ? 'Position the front of your ID within the frame and ensure all details are clear.'
                : 'Now capture the back of your ID card clearly.'}
            </Text>

            <TouchableOpacity
              style={[s.captureBox, { backgroundColor: C.surfaceAlt, borderColor: C.border }]}
              onPress={() => pickImage(isFront ? 'front' : 'back')}
            >
              {currentImg ? (
                <Image source={{ uri: currentImg }} style={s.capturedImg} />
              ) : (
                <View style={s.placeholderContent}>
                  <Ionicons name="camera-outline" size={48} color={C.textMuted} />
                  <Text style={[s.placeholderTxt, { color: C.textMuted }]}>Tap to Capture</Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.actionBtn, { backgroundColor: currentImg ? Colors.brand.primary : C.border }]}
              disabled={!currentImg}
              onPress={nextStep}
            >
              <Text style={s.actionBtnTxt}>Continue</Text>
            </TouchableOpacity>
          </View>
        );

      case 'selfie':
        return (
          <View style={s.stepContainer}>
            <Text style={[s.title, { color: C.text }]}>Selfie Check</Text>
            <Text style={[s.subtitle, { color: C.textSecondary }]}>
              Look straight into the camera and ensure your face is well-lit and within the circle.
            </Text>

            <View style={s.selfieWrap}>
              <TouchableOpacity
                style={[s.selfieCircle, { backgroundColor: C.surfaceAlt, borderColor: selfieImage ? Colors.brand.primary : C.border }]}
                onPress={() => pickImage('selfie')}
              >
                {selfieImage ? (
                  <Image source={{ uri: selfieImage }} style={s.selfieImg} />
                ) : (
                  <Ionicons name="person-outline" size={60} color={C.textMuted} />
                )}
              </TouchableOpacity>
              {!selfieImage && (
                <TouchableOpacity style={s.selfieBtn} onPress={() => pickImage('selfie')}>
                  <Ionicons name="camera" size={20} color="#fff" />
                  <Text style={s.selfieBtnTxt}>Take Selfie</Text>
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity
              style={[s.actionBtn, { backgroundColor: selfieImage ? Colors.brand.primary : C.border, marginTop: 40 }]}
              disabled={!selfieImage}
              onPress={nextStep}
            >
              <Text style={s.actionBtnTxt}>Confirm & Match</Text>
            </TouchableOpacity>
          </View>
        );

      case 'face_matching':
        return <FaceMatchingStep selfieImage={selfieImage!} C={C} />;

      case 'review':
        return (
          <View style={s.stepContainer}>
            <Text style={[s.title, { color: C.text }]}>Review Submission</Text>
            <Text style={[s.subtitle, { color: C.textSecondary }]}>
              Please double check that all photos are clear and readable.
            </Text>

            <View style={s.reviewGrid}>
              <View style={s.reviewItem}>
                <Text style={[s.reviewLabel, { color: C.textSecondary }]}>ID Front</Text>
                <Image source={{ uri: frontImage! }} style={s.reviewImg} />
              </View>
              {(idType === 'voters_card' || idType === 'identity_card') && (
                <View style={s.reviewItem}>
                  <Text style={[s.reviewLabel, { color: C.textSecondary }]}>ID Back</Text>
                  <Image source={{ uri: backImage! }} style={s.reviewImg} />
                </View>
              )}
              <View style={s.reviewItem}>
                <Text style={[s.reviewLabel, { color: C.textSecondary }]}>Selfie</Text>
                <Image source={{ uri: selfieImage! }} style={s.reviewImg} />
              </View>
            </View>

            <TouchableOpacity
              style={[s.actionBtn, { backgroundColor: Colors.brand.secondary, marginTop: 20 }]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.actionBtnTxt}>Submit Verification</Text>}
            </TouchableOpacity>
          </View>
        );
    }
  };

  return (
    <View style={[s.root, { backgroundColor: C.background, paddingTop: insets.top }]}>
      <View style={s.header}>
        <TouchableOpacity onPress={step === 'intro' ? () => router.back() : prevStep} style={s.backBtn}>
          <Ionicons name={step === 'intro' ? "close" : "chevron-back"} size={24} color={C.text} />
        </TouchableOpacity>
        <View style={s.progressBar}>
          {['intro', 'select_id', 'capture_front', 'capture_back', 'selfie', 'face_matching', 'review'].map((it, idx) => {
            const activeIdx = ['intro', 'select_id', 'capture_front', 'capture_back', 'selfie', 'face_matching', 'review'].indexOf(step);
            // Skip back step if not applicable
            if (it === 'capture_back' && idType !== 'voters_card' && idType !== 'identity_card') return null;
            if (it === 'face_matching') return null; // Don't show in progress bar

            return (
              <View
                key={it}
                style={[
                  s.progressDot,
                  { backgroundColor: idx <= activeIdx ? Colors.brand.primary : C.border }
                ]}
              />
            );
          })}
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {renderStep()}
      </ScrollView>

      <AlertModal
        isVisible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        confirmText={alertConfig.confirmText}
        showCancel={alertConfig.showCancel}
        onConfirm={() => {
          if (alertConfig.onConfirm) {
            alertConfig.onConfirm();
          } else {
            setAlertConfig(prev => ({ ...prev, visible: false }));
          }
        }}
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
    height: 60,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  progressBar: { flexDirection: 'row', gap: 6, flex: 1, justifyContent: 'center' },
  progressDot: { height: 4, flex: 1, borderRadius: 2, maxWidth: 30 },
  content: { padding: 24, flexGrow: 1 },
  stepContainer: { flex: 1 },
  lottie: { width: 180, height: 180, alignSelf: 'center', marginBottom: 20 },
  title: { fontSize: 26, fontWeight: '800', textAlign: 'center', marginBottom: 12 },
  subtitle: { fontSize: 16, textAlign: 'center', lineHeight: 24, marginBottom: 30 },
  infoList: { marginBottom: 40, gap: 16 },
  infoItem: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(0,0,0,0.03)', padding: 16, borderRadius: 12 },
  infoText: { fontSize: 14, fontWeight: '600' },
  actionBtn: { height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 'auto' },
  actionBtnTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },

  warningContent: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  warningBadge: { position: 'absolute', bottom: 10, right: 10, backgroundColor: Colors.brand.danger, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  warningIcon: { marginBottom: 24 },
  warningTitle: { fontSize: 22, fontWeight: '800', marginBottom: 12 },
  warningSub: { fontSize: 16, textAlign: 'center', lineHeight: 24, marginBottom: 32 },
  
  missingInfoBox: { width: '100%', backgroundColor: 'rgba(0,0,0,0.02)', padding: 20, borderRadius: 16, marginTop: 10 },
  missingInfoTitle: { fontSize: 15, fontWeight: '700', marginBottom: 16 },
  missingInfoList: { gap: 12 },
  infoItemSmall: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  infoItemTxt: { fontSize: 14, fontWeight: '600' },

  idList: { gap: 12, marginBottom: 40 },
  idItem: { flexDirection: 'row', alignItems: 'center', padding: 20, borderRadius: 16, borderWidth: 1.5, gap: 16 },
  idLabel: { fontSize: 16, fontWeight: '700', flex: 1 },

  captureBox: { width: '100%', aspectRatio: 16 / 10, borderRadius: 20, borderWidth: 2, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', marginBottom: 40 },
  capturedImg: { width: '100%', height: '100%', resizeMode: 'cover' },
  placeholderContent: { alignItems: 'center', gap: 12 },
  placeholderTxt: { fontSize: 16, fontWeight: '600' },

  selfieWrap: { alignItems: 'center', marginTop: 20 },
  selfieCircle: { width: 220, height: 220, borderRadius: 110, borderWidth: 4, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
  selfieImg: { width: '100%', height: '100%' },
  selfieBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.brand.primary, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 30, position: 'absolute', bottom: -20 },
  selfieBtnTxt: { color: '#fff', fontWeight: '700' },

  reviewGrid: { gap: 20, marginBottom: 30 },
  reviewItem: { gap: 10 },
  reviewLabel: { fontSize: 14, fontWeight: '700', marginLeft: 4 },
  reviewImg: { width: '100%', height: 180, borderRadius: 16, resizeMode: 'cover' },
  scanningContainer: { width: 220, height: 220, borderRadius: 110, overflow: 'hidden', position: 'relative', borderWidth: 4, borderColor: Colors.brand.primary },
  scanningImg: { width: '100%', height: '100%', opacity: 0.7 },
  introIconWrap: { width: 160, height: 160, borderRadius: 80, backgroundColor: Colors.brand.primary + '15', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 24 },
  scanLine: { position: 'absolute', width: '100%', height: 4, backgroundColor: Colors.brand.primary, zIndex: 10, shadowColor: Colors.brand.primary, shadowOpacity: 1, shadowRadius: 10, elevation: 5 },
});
