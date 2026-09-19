import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  FlatList,
  StyleSheet,
  SafeAreaView,
  Platform,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Localization from 'expo-localization';
import { Colors } from '@/constants/Colors';
import { useAppContext } from '@/context/AppContext';
import { countries, Country } from '@/constants/Countries';

interface PhoneInputProps {
  value: string;
  onChangeText: (text: string) => void;
  error?: string;
  placeholder?: string;
  isDriver?: boolean;
}

export default React.forwardRef<TextInput, PhoneInputProps>(function PhoneInput({
  value,
  onChangeText,
  error,
  placeholder = '801 234 5678',
  isDriver = false,
}, ref) {
  const { colorScheme } = useAppContext();
  const isDark = colorScheme === 'dark';
  const C = Colors[isDark ? 'dark' : 'light'];
  const accentColor = isDriver ? Colors.driver.primary : Colors.rider.primary;

  const [modalVisible, setModalVisible] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<Country>(countries.find(c => c.code === 'NG') || countries[0]);
  const [searchQuery, setSearchQuery] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');

  // Set default country based on location
  useEffect(() => {
    const regionCode = Localization.getLocales()[0]?.regionCode;
    if (regionCode) {
      const detected = countries.find(c => c.code === regionCode);
      if (detected) setSelectedCountry(detected);
    }
  }, []);

  // Update internal phone number state when prop value changes
  // This helps when value is passed from parent (e.g. initial params)
  useEffect(() => {
    if (value) {
      // Try to extract dial code if value starts with +
      if (value.startsWith('+')) {
        const matchingCountry = findCountryByNumber(value);
        if (matchingCountry) {
          setSelectedCountry(matchingCountry);
          // Strip the dial code from the displayed number
          setPhoneNumber(value.replace(matchingCountry.dialCode, '').trim());
        } else {
          setPhoneNumber(value);
        }
      } else {
        setPhoneNumber(value);
      }
    } else {
      setPhoneNumber('');
    }
  }, [value]);

  const findCountryByNumber = (text: string): Country | null => {
    if (!text.startsWith('+')) return null;
    
    // Sort countries by dialCode length descending to match longest code first (e.g., +1-242 vs +1)
    const sortedCountries = [...countries].sort((a, b) => b.dialCode.length - a.dialCode.length);
    
    for (const country of sortedCountries) {
      if (text.startsWith(country.dialCode)) {
        return country;
      }
    }
    return null;
  };

  const handleTextChange = (text: string) => {
    // If user types a full number starting with +, try to detect country
    if (text.startsWith('+')) {
      const detected = findCountryByNumber(text);
      if (detected) {
        setSelectedCountry(detected);
        let relativeNumber = text.replace(detected.dialCode, '').trim();
        // Strip leading zero if it exists
        if (relativeNumber.startsWith('0')) {
          relativeNumber = relativeNumber.substring(1);
        }
        setPhoneNumber(relativeNumber);
        onChangeText(detected.dialCode + ' ' + relativeNumber);
      } else {
        setPhoneNumber(text);
        onChangeText(text);
      }
    } else {
      // Strip leading zero if user types it manually while a country is selected
      let cleaned = text;
      if (text.startsWith('0') && text.length > 1) {
        cleaned = text.substring(1);
      }
      setPhoneNumber(cleaned);
      onChangeText(selectedCountry.dialCode + ' ' + cleaned);
    }
  };

  const handleCountrySelect = (country: Country) => {
    setSelectedCountry(country);
    setModalVisible(false);
    onChangeText(country.dialCode + ' ' + phoneNumber);
    setSearchQuery('');
  };

  const filteredCountries = countries.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.dialCode.includes(searchQuery) ||
    c.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <View style={styles.container}>
      <View style={[
        styles.inputWrapper,
        { backgroundColor: C.surface, borderColor: error ? Colors.brand.danger : C.border }
      ]}>
        <TouchableOpacity 
          style={styles.countryPicker}
          onPress={() => setModalVisible(true)}
        >
          <Text style={styles.flag}>{selectedCountry.flag}</Text>
          <Text style={[styles.dialCode, { color: C.text }]}>{selectedCountry.dialCode}</Text>
          <Ionicons name="chevron-down" size={14} color={C.textMuted} style={styles.chevron} />
        </TouchableOpacity>

        <View style={[styles.divider, { backgroundColor: C.border }]} />

        <TextInput
          ref={ref}
          style={[styles.input, { color: C.text }]}
          placeholder={placeholder}
          placeholderTextColor={C.textMuted}
          keyboardType="phone-pad"
          value={phoneNumber}
          onChangeText={handleTextChange}
          autoCapitalize="none"
        />
      </View>

      {error && <Text style={styles.errorText}>{error}</Text>}

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <SafeAreaView style={[styles.modalOverlay, { backgroundColor: isDark ? 'rgba(0,0,0,0.9)' : 'rgba(0,0,0,0.5)' }]}>
          <View style={[styles.modalContent, { backgroundColor: C.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: C.text }]}>Select Country</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={24} color={C.text} />
              </TouchableOpacity>
            </View>

            <View style={[styles.searchBar, { backgroundColor: C.surfaceAlt }]}>
              <Ionicons name="search" size={18} color={C.textMuted} style={styles.searchIcon} />
              <TextInput
                style={[styles.searchInput, { color: C.text }]}
                placeholder="Search country or code"
                placeholderTextColor={C.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus={false}
              />
            </View>

            <FlatList
              data={filteredCountries}
              keyExtractor={(item) => item.code}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={[styles.countryItem, { borderBottomColor: C.border }]}
                  onPress={() => handleCountrySelect(item)}
                >
                  <Text style={styles.itemFlag}>{item.flag}</Text>
                  <Text style={[styles.itemName, { color: C.text }]}>{item.name}</Text>
                  <Text style={[styles.itemCode, { color: C.textMuted }]}>{item.dialCode}</Text>
                  {selectedCountry.code === item.code && (
                    <Ionicons name="checkmark" size={20} color={accentColor} />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginBottom: 16,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  countryPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 8,
    minWidth: 80,
  },
  flag: {
    fontSize: 22,
    marginRight: 6,
  },
  dialCode: {
    fontSize: 16,
    fontWeight: '500',
  },
  chevron: {
    marginLeft: 4,
  },
  divider: {
    width: 1,
    height: 24,
    marginHorizontal: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    height: '100%',
  },
  errorText: {
    color: Colors.brand.danger,
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    height: '80%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 4,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
    marginBottom: 16,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  countryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  itemFlag: {
    fontSize: 24,
    marginRight: 14,
  },
  itemName: {
    flex: 1,
    fontSize: 16,
  },
  itemCode: {
    fontSize: 16,
    marginRight: 10,
  },
});
