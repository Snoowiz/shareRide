<?php

namespace App\Services\Payment;

use App\Models\Supabase\Delivery;
use App\Models\Supabase\Ride;
use App\Models\Supabase\Wallet;
use App\Models\Supabase\WalletTransaction;
use App\Services\NotificationService;
use Exception;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Throwable;

class PaymentManager
{
    /**
     * @var array<string, PaymentGatewayInterface>
     */
    protected array $gateways = [];

    public function __construct()
    {
        $this->registerGateway(new PaystackGateway());
        $this->registerGateway(new FlutterwaveGateway());
    }

    /**
     * Register a new gateway driver.
     */
    public function registerGateway(PaymentGatewayInterface $gateway): self
    {
        $this->gateways[$gateway->getId()] = $gateway;
        return $this;
    }

    /**
     * Get a specific gateway driver.
     */
    public function getGateway(string $id): PaymentGatewayInterface
    {
        $id = strtolower($id);
        if (!isset($this->gateways[$id])) {
            throw new Exception("Payment gateway [{$id}] is not supported.");
        }

        return $this->gateways[$id];
    }

    /**
     * Get all registered gateways.
     *
     * @return array<string, PaymentGatewayInterface>
     */
    public function getAllGateways(): array
    {
        return $this->gateways;
    }

    /**
     * Get only active/enabled gateways.
     *
     * @return array<string, PaymentGatewayInterface>
     */
    public function getEnabledGateways(): array
    {
        return array_filter($this->gateways, fn(PaymentGatewayInterface $g) => $g->isEnabled());
    }

    /**
     * Get public gateway configurations for mobile clients.
     * Never exposes secret keys or sensitive webhook hashes.
     */
    public function getPublicConfig(): array
    {
        $gatewayConfigs = [];
        $enabledIds = [];

        foreach ($this->gateways as $id => $gateway) {
            $isEnabled = $gateway->isEnabled();
            if ($isEnabled) {
                $enabledIds[] = $id;
            }

            $gatewayConfigs[] = [
                'id' => $gateway->getId(),
                'name' => $gateway->getName(),
                'enabled' => $isEnabled,
                'public_key' => $gateway->getPublicKey(),
                'currency' => $gateway->getCurrency(),
                'mode' => $gateway->getMode(),
            ];
        }

        return [
            'gateways' => $gatewayConfigs,
            'enabled_gateways' => $enabledIds,
            'default_gateway' => !empty($enabledIds) ? $enabledIds[0] : null,
        ];
    }

    /**
     * Process and record a settled transaction.
     * Idempotent: safe against duplicate webhook or verification calls.
     */
    public function processSettlement(array $verifiedData): array
    {
        $reference = $verifiedData['reference'] ?? null;
        $gatewayReference = $verifiedData['gateway_reference'] ?? $reference;
        $gateway = $verifiedData['gateway'] ?? 'unknown';
        $amount = (float) ($verifiedData['amount'] ?? 0);
        $currency = $verifiedData['currency'] ?? 'NGN';
        $metadata = $verifiedData['metadata'] ?? [];

        Log::info("Processing settlement for gateway [{$gateway}], ref [{$reference}], amount [{$amount}]", [
            'metadata' => $metadata
        ]);

        $result = [
            'reference' => $reference,
            'gateway' => $gateway,
            'amount' => $amount,
            'settled' => false,
            'type' => 'unknown',
        ];

        // 1. Check if this is a Driver Wallet Top-up
        $driverId = $metadata['driver_id'] ?? $metadata['user_id'] ?? null;
        $isTopup = ($metadata['type'] ?? '') === 'wallet_topup' || ($metadata['topup'] ?? false) || !empty($metadata['is_topup']);

        if ($isTopup && $driverId) {
            $result['type'] = 'wallet_topup';
            // Idempotency check: see if a transaction already exists with this reference or gateway reference
            $existingTx = WalletTransaction::where('paystack_reference', $reference)
                ->orWhere('gateway_reference', $gatewayReference)
                ->orWhere(function ($q) use ($reference) {
                    $q->where('description', 'like', "%{$reference}%");
                })
                ->first();

            if ($existingTx && $existingTx->status === 'completed') {
                $result['settled'] = true;
                $result['message'] = 'Transaction was already processed.';
                return $result;
            }

            // Execute wallet credit
            try {
                $wallet = Wallet::firstOrCreate(
                    ['id' => $driverId],
                    ['balance' => 0.00, 'currency' => $currency]
                );

                $newBalance = (float) $wallet->balance + $amount;
                $wallet->balance = $newBalance;
                $wallet->updated_at = now();
                $wallet->save();

                // Create or update WalletTransaction record
                $txId = (string) Str::uuid();
                WalletTransaction::create([
                    'id' => $txId,
                    'wallet_id' => $driverId,
                    'type' => 'credit',
                    'amount' => $amount,
                    'description' => "Wallet top-up via " . ucfirst($gateway) . " (Ref: {$reference})",
                    'status' => 'completed',
                    'payment_gateway' => $gateway,
                    'gateway_reference' => (string) $gatewayReference,
                    'paystack_reference' => $reference,
                    'category' => 'topup',
                ]);

                // Try to send notification to driver
                try {
                    $notificationService = app(NotificationService::class);
                    $notificationService->sendToUser(
                        $driverId,
                        'Wallet Funded',
                        "Your wallet has been credited with {$currency} " . number_format($amount, 2) . " via " . ucfirst($gateway) . ".",
                        'wallet',
                        ['amount' => $amount, 'reference' => $reference, 'balance' => $newBalance]
                    );
                } catch (Throwable $notifErr) {
                    Log::warning('Could not send wallet credit notification: ' . $notifErr->getMessage());
                }

                $result['settled'] = true;
                $result['new_balance'] = $newBalance;
                $result['message'] = 'Wallet credited successfully.';
                return $result;
            } catch (Throwable $e) {
                Log::error('Error crediting wallet in settlement: ' . $e->getMessage());
                throw $e;
            }
        }

        // 2. Check if this is a Ride Payment
        $rideId = $metadata['ride_id'] ?? null;
        if ($rideId) {
            $result['type'] = 'ride_payment';
            $ride = Ride::find($rideId);
            if ($ride) {
                $ride->payment_status = 'paid';
                $ride->payment_method = $gateway;
                $ride->save();

                // Record transaction if not already logged
                $existingTx = WalletTransaction::where('reference_id', $rideId)
                    ->where('status', 'completed')
                    ->first();

                if (!$existingTx && $ride->driver_id) {
                    WalletTransaction::create([
                        'id' => (string) Str::uuid(),
                        'wallet_id' => $ride->driver_id,
                        'type' => 'credit',
                        'amount' => $ride->driver_payout ?? $amount,
                        'description' => "Payout for Ride #{$rideId} via " . ucfirst($gateway),
                        'reference_id' => $rideId,
                        'status' => 'completed',
                        'payment_gateway' => $gateway,
                        'gateway_reference' => (string) $gatewayReference,
                        'paystack_reference' => $reference,
                        'category' => 'ride_fare',
                    ]);
                }

                $result['settled'] = true;
                $result['message'] = 'Ride marked as paid.';
                return $result;
            }
        }

        // 3. Check if this is a Delivery Payment
        $deliveryId = $metadata['delivery_id'] ?? null;
        if ($deliveryId) {
            $result['type'] = 'delivery_payment';
            $delivery = Delivery::find($deliveryId);
            if ($delivery) {
                $delivery->payment_status = 'paid';
                $delivery->payment_method = $gateway;
                $delivery->save();

                $result['settled'] = true;
                $result['message'] = 'Delivery marked as paid.';
                return $result;
            }
        }

        // Fallback generic settlement acknowledgement
        $result['settled'] = true;
        $result['message'] = 'Payment verified and logged.';
        return $result;
    }
}
