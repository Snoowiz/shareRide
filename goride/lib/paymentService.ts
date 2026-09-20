import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { supabase } from './supabase';

export type PaymentGatewayId = 'paystack' | 'flutterwave';

export interface PaymentInitParams {
  gateway: PaymentGatewayId;
  amount: number;
  email: string;
  name?: string;
  phone?: string;
  currency?: string;
  reference?: string;
  callbackUrl?: string;
  metadata?: Record<string, any>;
}

export interface PaymentInitResult {
  success: boolean;
  gateway?: string;
  reference?: string;
  access_code?: string;
  checkout_url?: string;
  error?: string;
  raw?: any;
}

export interface PaymentVerifyParams {
  gateway: PaymentGatewayId;
  reference: string;
  metadata?: Record<string, any>;
}

export interface PaymentVerifyResult {
  success: boolean;
  reference?: string;
  amount?: number;
  currency?: string;
  status?: string;
  error?: string;
  settlement?: {
    settled: boolean;
    new_balance?: number;
    message?: string;
    type?: string;
  };
  raw?: any;
}

const ADMIN_API_URL = process.env.EXPO_PUBLIC_ADMIN_API_URL || 'http://127.0.0.1:8000';
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';

/**
 * Initialize a payment session via backend API.
 */
export async function initializePayment(params: PaymentInitParams): Promise<PaymentInitResult> {
  const defaultCallback = Linking.createURL('payment-callback');

  try {
    const res = await fetch(`${ADMIN_API_URL}/api/v1/payments/initialize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        gateway: params.gateway,
        amount: params.amount,
        email: params.email,
        name: params.name,
        phone: params.phone,
        currency: params.currency || 'NGN',
        reference: params.reference,
        callback_url: params.callbackUrl || defaultCallback,
        metadata: params.metadata || {},
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      return {
        success: false,
        error: data.error || (data.errors ? JSON.stringify(data.errors) : 'Payment initialization failed.'),
      };
    }

    return {
      success: true,
      ...data.data,
    };
  } catch (err: any) {
    console.error('Payment initialization error:', err);
    return {
      success: false,
      error: err.message || 'Network error during payment initialization.',
    };
  }
}

/**
 * Open Flutterwave hosted checkout modal via Expo WebBrowser auth session.
 * Handles user completion and parses callback redirect back to the app.
 */
export async function openFlutterwaveCheckout(
  checkoutUrl: string,
  callbackUrl?: string
): Promise<{ success: boolean; reference?: string; cancelled?: boolean; error?: string }> {
  const redirect = callbackUrl || Linking.createURL('payment-callback');

  try {
    const authResult = await WebBrowser.openAuthSessionAsync(checkoutUrl, redirect);

    if (authResult.type === 'success' && authResult.url) {
      const parsed = Linking.parse(authResult.url);
      const query = parsed.queryParams || {};

      const status = (query.status as string || '').toLowerCase();
      const txRef = (query.tx_ref as string) || (query.reference as string);
      const transactionId = (query.transaction_id as string) || (query.flw_ref as string);

      if (status === 'successful' || status === 'completed') {
        return {
          success: true,
          reference: transactionId || txRef,
        };
      } else if (status === 'cancelled') {
        return {
          success: false,
          cancelled: true,
          error: 'Payment was cancelled.',
        };
      }

      // If status is ambiguous but reference exists, attempt server verification
      if (txRef || transactionId) {
        return {
          success: true,
          reference: transactionId || txRef,
        };
      }

      return {
        success: false,
        error: 'Payment was not completed.',
      };
    }

    if (authResult.type === 'cancel' || authResult.type === 'dismiss') {
      return {
        success: false,
        cancelled: true,
        error: 'Payment checkout window closed.',
      };
    }

    return {
      success: false,
      error: 'Unable to complete checkout session.',
    };
  } catch (err: any) {
    console.error('Flutterwave browser error:', err);
    return {
      success: false,
      error: err.message || 'Failed to open Flutterwave checkout.',
    };
  }
}

/**
 * Verify payment with backend server and settle ride/delivery/wallet.
 */
export async function verifyPayment(params: PaymentVerifyParams): Promise<PaymentVerifyResult> {
  try {
    const res = await fetch(`${ADMIN_API_URL}/api/v1/payments/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        gateway: params.gateway,
        reference: params.reference,
        metadata: params.metadata || {},
      }),
    });

    const data = await res.json();
    if (res.ok && data.success) {
      return {
        success: true,
        reference: data.data.reference,
        amount: data.data.amount,
        currency: data.data.currency,
        status: data.data.status,
        settlement: data.data.settlement,
        raw: data.data,
      };
    }

    // Fallback for Paystack if Admin API is unreachable or returns error:
    if (params.gateway === 'paystack') {
      try {
        const session = await supabase.auth.getSession();
        const token = session.data.session?.access_token;
        const edgeRes = await fetch(`${SUPABASE_URL}/functions/v1/verify-paystack-payment`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'apikey': process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
          },
          body: JSON.stringify({
            reference: params.reference,
            ...params.metadata,
          }),
        });

        const edgeData = await edgeRes.json();
        if (edgeData.success) {
          return {
            success: true,
            reference: edgeData.reference || params.reference,
            amount: edgeData.credited || edgeData.amount,
            settlement: {
              settled: true,
              new_balance: edgeData.new_balance,
              message: 'Verified via Paystack function.',
            },
          };
        }
      } catch (e) {
        // Ignore fallback error
      }
    }

    return {
      success: false,
      error: data.error || 'Payment verification failed.',
      raw: data,
    };
  } catch (err: any) {
    console.error('Payment verification error:', err);
    return {
      success: false,
      error: err.message || 'Network error during payment verification.',
    };
  }
}
