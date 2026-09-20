<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Payment\PaymentManager;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use Throwable;

class PaymentController extends Controller
{
    protected PaymentManager $paymentManager;

    public function __construct(PaymentManager $paymentManager)
    {
        $this->paymentManager = $paymentManager;
    }

    /**
     * Get public payment gateway configuration for mobile clients.
     * Only returns enabled gateways, their public keys, and currencies.
     *
     * GET /api/v1/payments/config
     */
    public function config(): JsonResponse
    {
        try {
            $config = $this->paymentManager->getPublicConfig();
            return response()->json([
                'success' => true,
                'data' => $config,
            ]);
        } catch (Throwable $e) {
            Log::error('PaymentController::config failed: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => 'Failed to retrieve payment configuration.',
            ], 500);
        }
    }

    /**
     * Initialize a payment session on Paystack or Flutterwave.
     *
     * POST /api/v1/payments/initialize
     */
    public function initialize(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'gateway' => 'required|string|in:paystack,flutterwave',
            'amount' => 'required|numeric|min:1',
            'email' => 'required|email',
            'name' => 'nullable|string|max:100',
            'phone' => 'nullable|string|max:30',
            'currency' => 'nullable|string|max:10',
            'reference' => 'nullable|string|max:100',
            'callback_url' => 'nullable|string',
            'metadata' => 'nullable|array',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors(),
            ], 422);
        }

        $gatewayName = strtolower($request->input('gateway'));

        try {
            $gateway = $this->paymentManager->getGateway($gatewayName);
            if (!$gateway->isEnabled()) {
                return response()->json([
                    'success' => false,
                    'error' => "The selected gateway [{$gateway->getName()}] is currently disabled.",
                ], 400);
            }

            $initResult = $gateway->initializePayment($request->all());

            if (!$initResult['success']) {
                return response()->json($initResult, 400);
            }

            return response()->json([
                'success' => true,
                'data' => $initResult,
            ]);
        } catch (Throwable $e) {
            Log::error("Payment initialization error for [{$gatewayName}]: " . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Verify payment status and settle transaction (credit wallet, update ride/delivery).
     *
     * POST /api/v1/payments/verify
     */
    public function verify(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'gateway' => 'required|string|in:paystack,flutterwave',
            'reference' => 'required|string|max:150',
            'metadata' => 'nullable|array',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors(),
            ], 422);
        }

        $gatewayName = strtolower($request->input('gateway'));
        $reference = trim($request->input('reference'));
        $clientMetadata = $request->input('metadata', []);

        try {
            $gateway = $this->paymentManager->getGateway($gatewayName);
            $verification = $gateway->verifyPayment($reference);

            if (!$verification['success']) {
                return response()->json([
                    'success' => false,
                    'error' => $verification['error'] ?? 'Payment verification failed.',
                    'raw' => $verification['raw'] ?? [],
                ], 400);
            }

            // Merge metadata passed from verification with any client metadata
            $metadata = array_merge(
                is_array($verification['metadata'] ?? null) ? $verification['metadata'] : [],
                $clientMetadata
            );
            $verification['metadata'] = $metadata;

            // Settle transaction
            $settlement = $this->paymentManager->processSettlement($verification);

            return response()->json([
                'success' => true,
                'data' => array_merge($verification, [
                    'settlement' => $settlement,
                ]),
            ]);
        } catch (Throwable $e) {
            Log::error("Payment verification error for [{$gatewayName}]: " . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Webhook listener for asynchronous payment notifications.
     *
     * POST /api/v1/payments/webhook/{gateway}
     */
    public function webhook(Request $request, string $gateway): JsonResponse
    {
        $gatewayName = strtolower($gateway);

        try {
            $gatewayInstance = $this->paymentManager->getGateway($gatewayName);
        } catch (Throwable $e) {
            return response()->json(['error' => 'Unsupported gateway'], 404);
        }

        if (!$gatewayInstance->verifyWebhook($request)) {
            Log::warning("Unauthorized webhook received for gateway [{$gatewayName}].");
            return response()->json(['error' => 'Invalid signature or webhook secret.'], 401);
        }

        $payload = $request->all();
        Log::info("Valid webhook received for [{$gatewayName}]", ['event' => $payload['event'] ?? $payload['data']['status'] ?? 'unknown']);

        try {
            if ($gatewayName === 'paystack') {
                $event = $payload['event'] ?? '';
                if ($event === 'charge.success') {
                    $data = $payload['data'] ?? [];
                    $this->paymentManager->processSettlement([
                        'gateway' => 'paystack',
                        'reference' => $data['reference'] ?? null,
                        'gateway_reference' => (string) ($data['id'] ?? $data['reference']),
                        'amount' => ((float) ($data['amount'] ?? 0)) / 100,
                        'currency' => $data['currency'] ?? 'NGN',
                        'metadata' => $data['metadata'] ?? [],
                    ]);
                }
            } elseif ($gatewayName === 'flutterwave') {
                $status = strtolower($payload['data']['status'] ?? $payload['status'] ?? '');
                if ($status === 'successful') {
                    $data = $payload['data'] ?? $payload;
                    $this->paymentManager->processSettlement([
                        'gateway' => 'flutterwave',
                        'reference' => $data['tx_ref'] ?? null,
                        'gateway_reference' => (string) ($data['id'] ?? $data['flw_ref'] ?? $data['tx_ref']),
                        'amount' => (float) ($data['amount'] ?? 0),
                        'currency' => $data['currency'] ?? 'NGN',
                        'metadata' => $data['meta'] ?? [],
                    ]);
                }
            }

            return response()->json(['status' => 'success']);
        } catch (Throwable $e) {
            Log::error("Error handling webhook for [{$gatewayName}]: " . $e->getMessage());
            return response()->json(['error' => 'Webhook processing failed'], 500);
        }
    }
}
