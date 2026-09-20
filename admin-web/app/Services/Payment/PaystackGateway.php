<?php

namespace App\Services\Payment;

use App\Models\Supabase\Setting;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

class PaystackGateway implements PaymentGatewayInterface
{
    protected const API_BASE = 'https://api.paystack.co';

    protected function getSettings(): array
    {
        try {
            return Cache::remember('paystack_gateway_settings', 60, function () {
                return Setting::where('key', 'like', 'paystack_%')
                    ->pluck('value', 'key')
                    ->toArray();
            });
        } catch (Throwable $e) {
            Log::warning('PaystackGateway: Failed to fetch settings from DB: ' . $e->getMessage());
            return [];
        }
    }

    public function getId(): string
    {
        return 'paystack';
    }

    public function getName(): string
    {
        return 'Paystack';
    }

    public function isEnabled(): bool
    {
        $settings = $this->getSettings();
        $val = $settings['paystack_enabled'] ?? true;
        return filter_var($val, FILTER_VALIDATE_BOOLEAN);
    }

    public function getMode(): string
    {
        $settings = $this->getSettings();
        return (string) ($settings['paystack_mode'] ?? 'test');
    }

    public function getPublicKey(): ?string
    {
        $settings = $this->getSettings();
        return $settings['paystack_public_key'] ?? null;
    }

    public function getSecretKey(): ?string
    {
        $settings = $this->getSettings();
        return $settings['paystack_secret_key'] ?? null;
    }

    public function getCurrency(): string
    {
        $settings = $this->getSettings();
        return strtoupper($settings['paystack_currency'] ?? 'NGN');
    }

    public function initializePayment(array $params): array
    {
        $secretKey = $this->getSecretKey();
        if (empty($secretKey)) {
            return ['success' => false, 'error' => 'Paystack secret key not configured.'];
        }

        $amountKobo = (int) round(((float) $params['amount']) * 100);
        $reference = $params['reference'] ?? ('PSTK_' . uniqid() . '_' . time());

        try {
            $response = Http::withToken($secretKey)
                ->timeout(15)
                ->post(self::API_BASE . '/transaction/initialize', [
                    'email' => $params['email'],
                    'amount' => $amountKobo,
                    'reference' => $reference,
                    'currency' => $params['currency'] ?? $this->getCurrency(),
                    'callback_url' => $params['callback_url'] ?? null,
                    'metadata' => $params['metadata'] ?? [],
                ]);

            if ($response->successful() && $response->json('status')) {
                $data = $response->json('data');
                return [
                    'success' => true,
                    'gateway' => 'paystack',
                    'reference' => $reference,
                    'access_code' => $data['access_code'] ?? null,
                    'checkout_url' => $data['authorization_url'] ?? null,
                    'raw' => $data,
                ];
            }

            return [
                'success' => false,
                'error' => $response->json('message') ?? 'Paystack initialization failed.',
                'raw' => $response->json(),
            ];
        } catch (Throwable $e) {
            Log::error('Paystack initialization exception: ' . $e->getMessage());
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    public function verifyPayment(string $reference): array
    {
        $secretKey = $this->getSecretKey();
        if (empty($secretKey)) {
            return ['success' => false, 'error' => 'Paystack secret key not configured.'];
        }

        try {
            $response = Http::withToken($secretKey)
                ->timeout(15)
                ->get(self::API_BASE . '/transaction/verify/' . rawurlencode($reference));

            $body = $response->json();
            if ($response->successful() && ($body['status'] ?? false) && ($body['data']['status'] ?? '') === 'success') {
                $data = $body['data'];
                return [
                    'success' => true,
                    'gateway' => 'paystack',
                    'reference' => $data['reference'] ?? $reference,
                    'gateway_reference' => (string) ($data['id'] ?? $reference),
                    'amount' => ((float) $data['amount']) / 100, // convert kobo to main currency
                    'currency' => $data['currency'] ?? 'NGN',
                    'status' => 'successful',
                    'customer_email' => $data['customer']['email'] ?? null,
                    'metadata' => $data['metadata'] ?? [],
                    'raw' => $data,
                ];
            }

            return [
                'success' => false,
                'error' => $body['message'] ?? 'Transaction verification failed or not successful.',
                'raw' => $body,
            ];
        } catch (Throwable $e) {
            Log::error('Paystack verification exception: ' . $e->getMessage());
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    public function verifyWebhook(Request $request): bool
    {
        $secretKey = $this->getSecretKey();
        if (empty($secretKey)) {
            return false;
        }

        $signature = $request->header('x-paystack-signature');
        if (!$signature) {
            return false;
        }

        $computed = hash_hmac('sha512', $request->getContent(), $secretKey);
        return hash_equals($computed, $signature);
    }

    public function testConnection(): array
    {
        $secretKey = $this->getSecretKey();
        if (empty($secretKey)) {
            return ['success' => false, 'message' => 'Paystack Secret Key is missing in settings.'];
        }

        try {
            $response = Http::withToken($secretKey)
                ->timeout(10)
                ->get(self::API_BASE . '/bank?currency=NGN');

            if ($response->successful() && $response->json('status')) {
                return ['success' => true, 'message' => 'Paystack API keys are valid and connected successfully.'];
            }

            return ['success' => false, 'message' => $response->json('message') ?? 'Invalid Paystack credentials.'];
        } catch (Throwable $e) {
            return ['success' => false, 'message' => 'Network error: ' . $e->getMessage()];
        }
    }
}
