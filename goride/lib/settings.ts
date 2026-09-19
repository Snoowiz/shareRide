import { supabase } from './supabase';

export interface AppSettings {
  search_radius_km: number;
  vehicle_categories: string[];
  base_fare_car: number;
  base_fare_bike: number;
  platform_fee_percentage: number;
  maintenance_mode: boolean;
  paystack_enabled: boolean;
  paystack_mode: 'test' | 'live';
  paystack_public_key: string;
  paystack_currency: string;
  enable_cash_payments: boolean;
  enable_wallet_payments: boolean;
  min_wallet_topup: number;
  min_driver_withdrawal: number;
  [key: string]: any;
}

// Default fallback settings in case of network failure or before admin config
const defaultSettings: AppSettings = {
  search_radius_km: 5,
  vehicle_categories: ['car', 'bike', 'van'],
  base_fare_car: 5.0,
  base_fare_bike: 2.5,
  platform_fee_percentage: 10.0,
  maintenance_mode: false,
  paystack_enabled: true,
  paystack_mode: 'test',
  paystack_public_key: process.env.EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY || '',
  paystack_currency: 'NGN',
  enable_cash_payments: true,
  enable_wallet_payments: true,
  min_wallet_topup: 500,
  min_driver_withdrawal: 1000,
};

let cachedSettings: AppSettings | null = null;
let lastFetchTime = 0;
const CACHE_TTL = 1000 * 60 * 2; // 2 minutes

export const getAppSettings = async (forceRefresh = false): Promise<AppSettings> => {
  const now = Date.now();
  if (!forceRefresh && cachedSettings && now - lastFetchTime < CACHE_TTL) {
    return cachedSettings;
  }

  try {
    const { data, error } = await supabase
      .from('settings')
      .select('key, value');

    if (error) {
      console.error('Failed to fetch settings from Supabase:', error);
      return cachedSettings || defaultSettings;
    }

    const settingsMap: any = { ...defaultSettings };
    if (data) {
      data.forEach((setting) => {
        let parsedValue = setting.value;
        try {
          if (typeof parsedValue === 'string') {
             parsedValue = JSON.parse(parsedValue);
          }
        } catch(e) {
             // Keep as string if it's not valid JSON
        }
        
        // Coerce types based on keys
        if (['search_radius_km', 'base_fare_car', 'base_fare_bike', 'platform_fee_percentage', 'min_wallet_topup', 'min_driver_withdrawal'].includes(setting.key)) {
           settingsMap[setting.key] = parseFloat(parsedValue);
        } else if (['maintenance_mode', 'paystack_enabled', 'enable_cash_payments', 'enable_wallet_payments'].includes(setting.key)) {
           settingsMap[setting.key] = parsedValue === true || parsedValue === 'true';
        } else {
           settingsMap[setting.key] = parsedValue;
        }
      });
    }

    cachedSettings = settingsMap as AppSettings;
    lastFetchTime = now;
    return cachedSettings;
  } catch (error) {
    console.error('Error in getAppSettings:', error);
    return cachedSettings || defaultSettings;
  }
};

/**
 * Returns the live resolved payment gateway configuration,
 * dynamically prioritized from Supabase settings with safe env fallback.
 */
export const getPaymentGatewayConfig = async (forceRefresh = false) => {
  const settings = await getAppSettings(forceRefresh);
  return {
    paystackEnabled: settings.paystack_enabled ?? true,
    paystackMode: (settings.paystack_mode || 'test') as 'test' | 'live',
    paystackPublicKey: settings.paystack_public_key || process.env.EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY || '',
    paystackCurrency: settings.paystack_currency || 'NGN',
    enableCashPayments: settings.enable_cash_payments ?? true,
    enableWalletPayments: settings.enable_wallet_payments ?? true,
    minWalletTopup: settings.min_wallet_topup ?? 500,
    minDriverWithdrawal: settings.min_driver_withdrawal ?? 1000,
  };
};
