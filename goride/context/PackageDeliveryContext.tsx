import React, { createContext, useContext, useState, useCallback } from 'react';

// ─── Types ───────────────────────────────────────────────────────────
export type ParcelType = {
  id: string;
  label: string;
  icon: string; // Ionicons name
  description: string;
};

export type ContactInfo = {
  phone: string;
  name: string;
  location: { latitude: number; longitude: number } | null;
  address: string;
};

export type VehicleType = {
  id: string;
  name: string;
  icon: string;
  baseFare: number;
  pricePerKm: number;
  capacity: string;
};

export type PayerType = 'sender' | 'receiver';
export type PaymentMethod = 'cash';

export interface PackageDeliveryState {
  // Step 1
  parcelType: ParcelType | null;
  // Step 2
  senderPhone: string;
  senderName: string;
  senderLocation: { latitude: number; longitude: number } | null;
  senderAddress: string;
  receiverPhone: string;
  receiverName: string;
  receiverLocation: { latitude: number; longitude: number } | null;
  receiverAddress: string;
  // Step 3
  parcelWeight: string;
  // Step 4
  selectedVehicleType: VehicleType | null;
  // Step 5
  payerType: PayerType;
  paymentMethod: PaymentMethod;
  // Computed
  distanceKm: number;
  durationMins: number;
  fare: number;
  offerFare: string;
  // Step 6-7
  isSearching: boolean;
  currentDeliveryId: string | null;
  parcelImageUrl: string | null;
  termsAccepted: boolean;
}

// ─── Parcel Categories (will be dynamic from admin later) ────────────
export const PARCEL_TYPES: ParcelType[] = [
  { id: 'fragile', label: 'Fragile', icon: 'wine-outline', description: 'Glass, ceramics, electronics' },
  { id: 'documents', label: 'Documents', icon: 'document-text-outline', description: 'Papers, letters, files' },
  { id: 'gift', label: 'Gift', icon: 'gift-outline', description: 'Wrapped items, presents' },
  { id: 'food', label: 'Food', icon: 'fast-food-outline', description: 'Meals, perishables' },
  { id: 'clothing', label: 'Clothing', icon: 'shirt-outline', description: 'Garments, fabrics' },
  { id: 'other', label: 'Other', icon: 'cube-outline', description: 'General items' },
];

export const VEHICLE_TYPES: VehicleType[] = [
  { id: 'bike', name: 'Bike', icon: 'bicycle', baseFare: 400, pricePerKm: 80, capacity: 'Up to 5kg' },
  { id: 'car', name: 'Car', icon: 'car', baseFare: 800, pricePerKm: 150, capacity: 'Up to 25kg' },
];

// ─── Context Interface ──────────────────────────────────────────────
interface PackageDeliveryContextType {
  state: PackageDeliveryState;
  setParcelType: (type: ParcelType) => void;
  setSenderInfo: (info: Partial<ContactInfo>) => void;
  setReceiverInfo: (info: Partial<ContactInfo>) => void;
  setParcelWeight: (weight: string) => void;
  setSelectedVehicle: (vehicle: VehicleType) => void;
  setPayerType: (payer: PayerType) => void;
  setPaymentMethod: (method: PaymentMethod) => void;
  setRouteInfo: (distanceKm: number, durationMins: number) => void;
  setFare: (fare: number) => void;
  setOfferFare: (offer: string) => void;
  setSearchState: (isSearching: boolean, deliveryId: string | null) => void;
  setParcelImage: (url: string | null) => void;
  setTermsAccepted: (accepted: boolean) => void;
  resetState: () => void;
}

const initialState: PackageDeliveryState = {
  parcelType: null,
  senderPhone: '',
  senderName: '',
  senderLocation: null,
  senderAddress: '',
  receiverPhone: '',
  receiverName: '',
  receiverLocation: null,
  receiverAddress: '',
  parcelWeight: '',
  selectedVehicleType: null,
  payerType: 'sender',
  paymentMethod: 'cash',
  distanceKm: 0,
  durationMins: 0,
  fare: 0,
  offerFare: '',
  isSearching: false,
  currentDeliveryId: null,
  parcelImageUrl: null,
  termsAccepted: false,
};

const PackageDeliveryContext = createContext<PackageDeliveryContextType | undefined>(undefined);

export function PackageDeliveryProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<PackageDeliveryState>(initialState);

  const setParcelType = useCallback((type: ParcelType) => {
    setState(prev => ({ ...prev, parcelType: type }));
  }, []);

  const setSenderInfo = useCallback((info: Partial<ContactInfo>) => {
    setState(prev => ({
      ...prev,
      ...(info.phone !== undefined && { senderPhone: info.phone }),
      ...(info.name !== undefined && { senderName: info.name }),
      ...(info.location !== undefined && { senderLocation: info.location }),
      ...(info.address !== undefined && { senderAddress: info.address }),
    }));
  }, []);

  const setReceiverInfo = useCallback((info: Partial<ContactInfo>) => {
    setState(prev => ({
      ...prev,
      ...(info.phone !== undefined && { receiverPhone: info.phone }),
      ...(info.name !== undefined && { receiverName: info.name }),
      ...(info.location !== undefined && { receiverLocation: info.location }),
      ...(info.address !== undefined && { receiverAddress: info.address }),
    }));
  }, []);

  const setParcelWeight = useCallback((weight: string) => {
    setState(prev => ({ ...prev, parcelWeight: weight }));
  }, []);

  const setSelectedVehicle = useCallback((vehicle: VehicleType) => {
    setState(prev => ({ ...prev, selectedVehicleType: vehicle }));
  }, []);

  const setPayerType = useCallback((payer: PayerType) => {
    setState(prev => ({ ...prev, payerType: payer }));
  }, []);

  const setPaymentMethod = useCallback((method: PaymentMethod) => {
    setState(prev => ({ ...prev, paymentMethod: method }));
  }, []);

  const setRouteInfo = useCallback((distanceKm: number, durationMins: number) => {
    setState(prev => ({ ...prev, distanceKm, durationMins }));
  }, []);

  const setFare = useCallback((fare: number) => {
    setState(prev => ({ ...prev, fare }));
  }, []);

  const setOfferFare = useCallback((offer: string) => {
    setState(prev => ({ ...prev, offerFare: offer }));
  }, []);

  const setSearchState = useCallback((isSearching: boolean, deliveryId: string | null) => {
    setState(prev => ({ ...prev, isSearching, currentDeliveryId: deliveryId }));
  }, []);

  const setParcelImage = useCallback((url: string | null) => {
    setState(prev => ({ ...prev, parcelImageUrl: url }));
  }, []);

  const setTermsAccepted = useCallback((accepted: boolean) => {
    setState(prev => ({ ...prev, termsAccepted: accepted }));
  }, []);

  const resetState = useCallback(() => {
    setState(initialState);
  }, []);

  return (
    <PackageDeliveryContext.Provider value={{
      state,
      setParcelType,
      setSenderInfo,
      setReceiverInfo,
      setParcelWeight,
      setSelectedVehicle,
      setPayerType,
      setPaymentMethod,
      setRouteInfo,
      setFare,
      setOfferFare,
      setSearchState,
      setParcelImage,
      setTermsAccepted,
      resetState,
    }}>
      {children}
    </PackageDeliveryContext.Provider>
  );
}

export function usePackageDelivery(): PackageDeliveryContextType {
  const ctx = useContext(PackageDeliveryContext);
  if (!ctx) throw new Error('usePackageDelivery must be used within PackageDeliveryProvider');
  return ctx;
}
