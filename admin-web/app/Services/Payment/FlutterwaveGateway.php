<?php

namespace App\Services\Payment;

use App\Models\Supabase\Setting;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

class FlutterwaveGateway implements PaymentGatewayInterface
{
    protected const API_BASE = 'https://api.flutterwave.com/v3';

    protected function getSettings(): array
    {
        try {
            return Cache::remember('flutterwave_gateway_settings', 60, function () {
                return Setting::where('key', 'like', 'flutterwave_%')
                    ->pluck('value', 'key')
                    ->toArray();
            });
        } catch (Throwable $e) {
            Log::warning('FlutterwaveGateway: Failed to fetch settings from DB: ' . $e->getMessage());
            return [];
        }
    }

    public function getId(): string
    {
        return 'flutterwave';
    }

    public function getName(): string
    {
        return 'Flutterwave';
    }

    public function isEnabled(): bool
    {
        $settings = $this->getSettings();
        $val = $settings['flutterwave_enabled'] ?? false;
        return filter_var($val, FILTER_VALIDATE_BOOLEAN);
    }

    public function getMode(): string
    {
        $settings = $this->getSettings();
        return (string) ($settings['flutterwave_mode'] ?? 'test');
    }

    public function getPublicKey(): ?string
    {
        $settings = $this->getSettings();
        return $settings['flutterwave_public_key'] ?? null;
    }

    public function getSecretKey(): ?string
    {
        $settings = $this->getSettings();
        return $settings['flutterwave_secret_key'] ?? null;
    }

    public function getEncryptionKey(): ?string
    {
        $settings = $this->getSettings();
        return $settings['flutterwave_encryption_key'] ?? null;
    }

    public function getWebhookHash(): ?string
    {
        $settings = $this->getSettings();
        return $settings['flutterwave_webhook_hash'] ?? null;
    }

    public function getCurrency(): string
    {
        $settings = $this->getSettings();
        return strtoupper($settings['flutterwave_currency'] ?? 'NGN');
    }

    public function initializePayment(array $params): array
    {
        $secretKey = $this->getSecretKey();
        if (empty($secretKey)) {
            return ['success' => false, 'error' => 'Flutterwave secret key not configured.'];
        }

        $reference = $params['reference'] ?? ('FLW_' . uniqid() . '_' . time());
        $amount = (float) $params['amount'];

        $payload = [
            'tx_ref' => $reference,
            'amount' => (string) $amount,
            'currency' => $params['currency'] ?? $this->getCurrency(),
            'redirect_url' => $params['callback_url'] ?? 'goride://payment-callback',
            'customer' => [
                'email' => $params['email'] ?? 'customer@goride.com',
                'name' => $params['name'] ?? 'GoRide Customer',
                'phonenumber' => $params['phone'] ?? '',
            ],
            'customizations' => [
                'title' => 'GoRide Payment',
                'description' => $params['description'] ?? 'Payment for GoRide services',
                'logo' => asset('images/logo.png'),
            ],
            'meta' => $params['metadata'] ?? [],
        ];

        try {
            $response = Http::withToken($secretKey)
                ->timeout(15)
                ->post(self::API_BASE . '/payments', $payload);

            $body = $response->json();
            if ($response->successful() && ($body['status'] ?? '') === 'success') {
                $link = $body['data']['link'] ?? null;
                return [
                    'success' => true,
                    'gateway' => 'flutterwave',
                    'reference' => $reference,
                    'checkout_url' => $link,
                    'raw' => $body['data'] ?? [],
                ];
            }

            return [
                'success' => false,
                'error' => $body['message'] ?? 'Flutterwave initialization failed.',
                'raw' => $body,
            ];
        } catch (Throwable $e) {
            Log::error('Flutterwave initialization exception: ' . $e->getMessage());
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    public function verifyPayment(string $reference): array
    {
        $secretKey = $this->getSecretKey();
        if (empty($secretKey)) {
            return ['success' => false, 'error' => 'Flutterwave secret key not configured.'];
        }

        try {
            // Flutterwave can verify by transaction ID (numeric) or by tx_ref query parameter
            if (is_numeric($reference)) {
                $url = self::API_BASE . '/transactions/' . rawurlencode($reference) . '/verify';
                $response = Http::withToken($secretKey)->timeout(15)->get($url);
            } else {
                $url = self::API_BASE . '/transactions/verify_by_reference?tx_ref=' . rawurlencode($reference);
                $response = Http::withToken($secretKey)->timeout(15)->get($url);
            }

            $body = $response->json();
            if ($response->successful() && ($body['status'] ?? '') === 'success') {
                $data = $body['data'] ?? [];
                $status = strtolower($data['status'] ?? '');

                if ($status === 'successful') {
                    return [
                        'success' => true,
                        'gateway' => 'flutterwave',
                        'reference' => $data['tx_ref'] ?? $reference,
                        'gateway_reference' => (string) ($data['id'] ?? $data['flw_ref'] ?? $reference),
                        'amount' => (float) ($data['amount'] ?? 0),
                        'currency' => $data['currency'] ?? 'NGN',
                        'status' => 'successful',
                        'customer_email' => $data['customer']['email'] ?? null,
                        'metadata' => $data['meta'] ?? [],
                        'raw' => $data,
                    ];
                }

                return [
                    'success' => false,
                    'error' => 'Flutterwave transaction is in ' . $status . ' status.',
                    'raw' => $data,
                ];
            }

            return [
                'success' => false,
                'error' => $body['message'] ?? 'Transaction verification failed with Flutterwave.',
                'raw' => $body,
            ];
        } catch (Throwable $e) {
            Log::error('Flutterwave verification exception: ' . $e->getMessage());
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    public function verifyWebhook(Request $request): bool
    {
        $expectedHash = $this->getWebhookHash();
        if (empty($expectedHash)) {
            return true; // if no secret hash configured, accept with caution
        }

        $signature = $request->header('verif-hash');
        if (!$signature) {
            return false;
        }

        return hash_equals($expectedHash, $signature);
    }

    public function testConnection(): array
    {
        $secretKey = $this->getSecretKey();
        if (empty($secretKey)) {
            return ['success' => false, 'message' => 'Flutterwave Secret Key is missing in settings.'];
        }

        try {
            $response = Http::withToken($secretKey)
                ->timeout(10)
                ->get(self::API_BASE . '/banks/NG');

            if ($response->successful() && ($response->json('status') ?? '') === 'success') {
                return ['success' => true, 'message' => 'Flutterwave API keys are valid and connected successfully.'];
            }

            return ['success' => false, 'message' => $response->json('message') ?? 'Invalid Flutterwave credentials.'];
        } catch (Throwable $e) {
            return ['success' => false, 'message' => 'Network error: ' . $e->getMessage()];
        }
    }
}
