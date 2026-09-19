import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, FlatList, Dimensions, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppContext } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { Colors } from '@/constants/Colors';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const ONBOARDING_DATA = [
  {
    id: '1',
    title: 'Request a Ride',
    description: 'Find a driver quickly and reach your destination safely with our premium service.',
    image: require('@/assets/images/on_board_one.png'),
  },
  {
    id: '2',
    title: 'Track Your Driver',
    description: 'Watch your driver arrive in real-time on the map and stay updated.',
    image: require('@/assets/images/on_board_two.png'),
  },
  {
    id: '3',
    title: 'Send Deliveries',
    description: 'Need to send a package? Our reliable couriers will handle it with care.',
    image: require('@/assets/images/on_board_three.png'),
  },
  {
    id: '4',
    title: 'Earn as a Driver',
    description: 'Join our fleet and start earning on your own schedule today.',
    image: require('@/assets/images/on_board_four.png'),
  },
];

export default function EntryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colorScheme } = useAppContext();
  const { setSelectedRole } = useAuth();
  const C = Colors[colorScheme];

  const [isLoading, setIsLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    const checkOnboarding = async () => {
      try {
        const hasSeen = await AsyncStorage.getItem('@goride_onboarding_complete');
        if (hasSeen !== 'true') {
          setShowOnboarding(true);
        }
      } catch (e) {
        setShowOnboarding(true);
      } finally {
        setIsLoading(false);
      }
    };
    checkOnboarding();
  }, []);

  const completeOnboarding = async () => {
    await AsyncStorage.setItem('@goride_onboarding_complete', 'true');
    setShowOnboarding(false);
  };

  const handleSelectRole = (role: 'user' | 'driver') => {
    setSelectedRole(role);
    // Navigate to the login screen with role parameter
    router.push({ pathname: '/(auth)/login', params: { role } });
  };

  if (isLoading) {
    return (
      <View style={[s.root, { backgroundColor: C.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={Colors.brand.primary} />
      </View>
    );
  }

  if (showOnboarding) {
    return <OnboardingFlow onComplete={completeOnboarding} colorScheme={colorScheme} insets={insets} />;
  }

  return (
    <View style={[s.root, { backgroundColor: C.background, paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      
      {/* Centered Logo Section */}
      <View style={s.centerContent}>
        <View style={s.logoWrap}>
          <Ionicons name="car-sport" size={64} color={C.tint} />
        </View>
        <Text style={[s.logoText, { color: C.text }]}>GoRide</Text>
        <View style={[s.divider, { backgroundColor: C.border }]} />
        
        <Text style={[s.tagline, { color: C.textSecondary }]}>
          "Embrace the Freedom, Let's Go{'\n'}and Ride with Pride!"
        </Text>
      </View>

      {/* Bottom Actions */}
      <View style={s.actions}>
        <TouchableOpacity
          style={[s.primaryBtn, { backgroundColor: Colors.brand.primary }]}
          activeOpacity={0.8}
          onPress={() => handleSelectRole('user')}
        >
          <Text style={s.primaryBtnTxt}>ENTER AS USER</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[s.secondaryBtn, { borderColor: colorScheme === 'dark' ? '#fff' : Colors.brand.primary }]}
          activeOpacity={0.7}
          onPress={() => handleSelectRole('driver')}
        >
          <Text style={[s.secondaryBtnTxt, { color: colorScheme === 'dark' ? '#fff' : Colors.brand.primary }]}>
            ENTER AS DRIVER
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function OnboardingFlow({ onComplete, colorScheme, insets }: { onComplete: () => void, colorScheme: 'light' | 'dark', insets: any }) {
  const C = Colors[colorScheme];
  const scrollX = useRef(new Animated.Value(0)).current;
  const flatListRef = useRef<FlatList>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const viewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems[0]) {
      setCurrentIndex(viewableItems[0].index);
    }
  }).current;

  const viewConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const handleNext = () => {
    if (currentIndex < ONBOARDING_DATA.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
    } else {
      onComplete();
    }
  };

  const renderItem = ({ item, index }: any) => {
    const inputRange = [(index - 1) * SCREEN_WIDTH, index * SCREEN_WIDTH, (index + 1) * SCREEN_WIDTH];
    
    const scale = scrollX.interpolate({
      inputRange,
      outputRange: [0.8, 1, 0.8],
      extrapolate: 'clamp',
    });

    const opacity = scrollX.interpolate({
      inputRange,
      outputRange: [0, 1, 0],
      extrapolate: 'clamp',
    });

    return (
      <View style={[obs.slide, { width: SCREEN_WIDTH }]}>
        <View style={obs.imageContainer}>
          <Animated.Image 
            source={item.image} 
            style={[obs.image, { transform: [{ scale }] }]} 
            resizeMode="contain" 
          />
        </View>
        <Animated.View style={[obs.textContainer, { opacity }]}>
          <Text style={[obs.title, { color: C.text }]}>{item.title}</Text>
          <Text style={[obs.description, { color: C.textSecondary }]}>{item.description}</Text>
        </Animated.View>
      </View>
    );
  };

  return (
    <View style={[obs.root, { backgroundColor: C.background }]}>
      {/* Skip Button */}
      <View style={[obs.header, { marginTop: insets.top + 8 }]}>
        <TouchableOpacity 
          style={obs.skipBtn} 
          onPress={onComplete}
          activeOpacity={0.7}
        >
          <Text style={[obs.skipTxt, { color: C.textSecondary }]}>Skip</Text>
        </TouchableOpacity>
      </View>

      <Animated.FlatList
        ref={flatListRef}
        data={ONBOARDING_DATA}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        pagingEnabled
        bounces={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false }
        )}
        onViewableItemsChanged={viewableItemsChanged}
        viewabilityConfig={viewConfig}
        scrollEventThrottle={32}
      />

      <View style={[obs.bottomContainer, { paddingBottom: insets.bottom + 24 }]}>
        <View style={obs.paginator}>
          {ONBOARDING_DATA.map((_, i) => {
            const inputRange = [(i - 1) * SCREEN_WIDTH, i * SCREEN_WIDTH, (i + 1) * SCREEN_WIDTH];
            const dotWidth = scrollX.interpolate({
              inputRange,
              outputRange: [8, 24, 8],
              extrapolate: 'clamp',
            });
            const opacity = scrollX.interpolate({
              inputRange,
              outputRange: [0.3, 1, 0.3],
              extrapolate: 'clamp',
            });
            const bgColor = colorScheme === 'dark' ? '#fff' : Colors.brand.primary;
            return (
              <Animated.View 
                key={i.toString()} 
                style={[obs.dot, { width: dotWidth, opacity, backgroundColor: bgColor }]} 
              />
            );
          })}
        </View>

        <TouchableOpacity 
          style={[
            obs.nextBtn, 
            { backgroundColor: colorScheme === 'dark' ? '#fff' : Colors.brand.primary },
            currentIndex === ONBOARDING_DATA.length - 1 && obs.nextBtnGetStarted
          ]} 
          activeOpacity={0.8}
          onPress={handleNext}
        >
          {currentIndex === ONBOARDING_DATA.length - 1 ? (
            <Text style={[obs.nextBtnTxt, { color: colorScheme === 'dark' ? '#000' : '#fff' }]}>
              Get Started
            </Text>
          ) : (
            <Ionicons name="arrow-forward" size={24} color={colorScheme === 'dark' ? '#000' : '#fff'} />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoWrap: {
    marginBottom: 16,
  },
  logoText: {
    fontSize: 48,
    fontWeight: '900',
    letterSpacing: -1,
  },
  divider: {
    width: 60,
    height: 2,
    marginTop: 24,
    marginBottom: 24,
    borderRadius: 1,
  },
  tagline: {
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  actions: {
    gap: 16,
    paddingBottom: 24,
  },
  primaryBtn: {
    paddingVertical: 18,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  primaryBtnTxt: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  secondaryBtn: {
    paddingVertical: 18,
    borderRadius: 30,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnTxt: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});

const obs = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 24,
    zIndex: 10,
  },
  skipBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  skipTxt: {
    fontSize: 15,
    fontWeight: '600',
  },
  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  imageContainer: {
    flex: 0.6,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  image: {
    width: SCREEN_WIDTH * 0.8,
    height: SCREEN_WIDTH * 0.8,
  },
  textContainer: {
    flex: 0.4,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 16,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  description: {
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 16,
  },
  bottomContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
  },
  paginator: {
    flexDirection: 'row',
    height: 64,
    alignItems: 'center',
  },
  dot: {
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  nextBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  nextBtnGetStarted: {
    width: 'auto',
    paddingHorizontal: 32,
  },
  nextBtnTxt: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
