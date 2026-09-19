import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import Modal from 'react-native-modal';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useAppContext } from '@/context/AppContext';
import LottieView from 'lottie-react-native';

const { width } = Dimensions.get('window');

interface AlertModalProps {
  isVisible: boolean;
  title: string;
  message: string;
  type?: 'success' | 'info' | 'warning' | 'error';
  confirmText?: string;
  onConfirm?: () => void;
  cancelText?: string;
  onCancel?: () => void;
  onClose: () => void;
  showCancel?: boolean;
}

export default function AlertModal({
  isVisible,
  title,
  message,
  type = 'info',
  confirmText = 'OK',
  onConfirm,
  cancelText = 'Cancel',
  onCancel,
  onClose,
  showCancel = false,
}: AlertModalProps) {
  const { colorScheme } = useAppContext();
  const isDark = colorScheme === 'dark';
  const C = Colors[colorScheme];

  const getIconName = () => {
    switch (type) {
      case 'success': return 'checkmark-circle';
      case 'warning': return 'warning';
      case 'error': return 'close-circle';
      default: return 'information-circle';
    }
  };

  const getIconColor = () => {
    switch (type) {
      case 'success': return '#22C55E';
      case 'warning': return '#F59E0B';
      case 'error': return '#EF4444';
      default: return isDark ? '#FCCA14' : '#0F346E';
    }
  };

  const handleConfirm = () => {
    if (onConfirm) onConfirm();
    onClose();
  };

  const handleCancel = () => {
    if (onCancel) onCancel();
    onClose();
  };

  return (
    <Modal
      isVisible={isVisible}
      onBackdropPress={onClose}
      onBackButtonPress={onClose}
      backdropOpacity={0.5}
      animationIn="zoomIn"
      animationOut="zoomOut"
      useNativeDriver
      hideModalContentWhileAnimating
    >
      <View style={[s.container, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF' }]}>
        <View style={s.content}>
          <View style={[s.iconBg, { backgroundColor: type === 'success' ? 'transparent' : getIconColor() + '15' }]}>
            {type === 'success' ? (
              <LottieView
                source={require('@/assets/lottie/success.json')}
                autoPlay
                loop={false}
                style={{ width: 120, height: 120 }}
              />
            ) : (
              <Ionicons name={getIconName()} size={40} color={getIconColor()} />
            )}
          </View>
          
          <Text style={[s.title, { color: C.text }]}>{title}</Text>
          <Text style={[s.message, { color: C.textSecondary }]}>{message}</Text>
        </View>

        <View style={[s.buttonRow, { borderTopColor: C.border }]}>
          {showCancel && (
            <TouchableOpacity 
              style={[s.button, s.secondaryButton]} 
              onPress={handleCancel}
            >
              <Text style={[s.secondaryButtonText, { color: C.textMuted }]}>{cancelText}</Text>
            </TouchableOpacity>
          )}
          
          <TouchableOpacity 
            style={[s.button, s.primaryButton, { backgroundColor: isDark ? '#FCCA14' : '#0F346E' }]} 
            onPress={handleConfirm}
          >
            <Text style={[s.primaryButtonText, { color: isDark ? '#000' : '#fff' }]}>{confirmText}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  container: {
    borderRadius: 24,
    overflow: 'hidden',
    width: width * 0.85,
    alignSelf: 'center',
    paddingTop: 30,
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 30,
  },
  iconBg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 12,
  },
  message: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    fontWeight: '500',
  },
  buttonRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
  },
  button: {
    flex: 1,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    // Background color set dynamically
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    borderRightWidth: 1,
    borderRightColor: 'rgba(0,0,0,0.05)',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
