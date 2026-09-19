import React from 'react';
import { View } from 'react-native';
import { Image as ExpoImage } from 'expo-image';

interface Props {
  heading: number;
  isBike?: boolean;
}

export default function PremiumVehicleMarker({ heading, isBike }: Props) {
  // Using the SVG assets with a sleek, smaller size (width 20, height 40)
  return (
    <View style={{
      width: 40, height: 40, alignItems: 'center', justifyContent: 'center',
      transform: [{ rotate: `${heading}deg` }]
    }}>
      <ExpoImage 
        source={isBike ? require('@/assets/svg/bike_marker.svg') : require('@/assets/svg/car_marker.svg')}
        style={{ width: 20, height: 40 }}
        contentFit="contain"
      />
    </View>
  );
}
