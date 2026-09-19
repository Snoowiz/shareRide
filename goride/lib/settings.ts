import { supabase } from './supabase';

export interface AppSettings {
  search_radius_km: number;
  vehicle_categories: string[];
  base_fare_car: number;
  base_fare_bike: number;
  platform_fee_percentage: number;
  maintenance_mode: boolean;
  [key: string]: any;
}

// Default fallback settings in case of network failure
const defaultSettings: AppSettings = {
  search_radius_km: 5,
  vehicle_categories: ['car', 'bike', 'van'],
  base_fare_car: 5.0,
  base_fare_bike: 2.5,
  platform_fee_percentage: 10.0,
  maintenance_mode: false,
};

let cachedSettings: AppSettings | null = null;
let lastFetchTime = 0;
const CACHE_TTL = 1000 * 60 * 5; // 5 minutes

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
        // Handle parsing of JSON values appropriately
        let parsedValue = setting.value;
        try {
          if (typeof parsedValue === 'string') {
             parsedValue = JSON.parse(parsedValue);
          }
        } catch(e) {
             // Keep as string if it's not valid JSON
        }
        
        // Coerce types based on keys
        if (['search_radius_km', 'base_fare_car', 'base_fare_bike', 'platform_fee_percentage'].includes(setting.key)) {
           settingsMap[setting.key] = parseFloat(parsedValue);
        } else if (setting.key === 'maintenance_mode') {
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
