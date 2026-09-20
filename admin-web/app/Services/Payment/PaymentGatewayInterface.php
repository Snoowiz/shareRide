<?php

namespace App\Services\Payment;

use Illuminate\Http\Request;

interface PaymentGatewayInterface
{
    /**
     * Unique identifier (e.g. 'paystack', 'flutterwave').
     */
    public function getId(): string;

    /**
     * Human readable display name.
     */
    public function getName(): string;

    /**
     * Is this gateway currently enabled in settings?
     */
    public function isEnabled(): bool;

    /**
     * Operating mode ('test' or 'live').
     */
    public function getMode(): string;

    /**
     * Client-safe public key.
     */
    public function getPublicKey(): ?string;

    /**
     * Supported / configured currency code (e.g. 'NGN').
     */
    public function getCurrency(): string;

    /**
     * Initialize a payment session.
     *
     * @param array $params ['amount', 'email', 'name', 'phone', 'reference', 'callback_url', 'metadata']
     * @return array ['success' => bool, 'reference' => string, 'checkout_url' => ?string, 'raw' => array]
     */
    public function initializePayment(array $params): array;

    /**
     * Verify a transaction with the provider.
     *
     * @param string $reference Transaction reference or transaction ID
     * @return array ['success' => bool, 'reference' => string, 'amount' => float, 'currency' => string, 'status' => string, 'customer_email' => ?string, 'raw' => array]
     */
    public function verifyPayment(string $reference): array;

    /**
     * Validate an incoming webhook from the payment provider.
     */
    public function verifyWebhook(Request $request): bool;

    /**
     * Test the API credentials.
     *
     * @return array ['success' => bool, 'message' => string]
     */
    public function testConnection(): array;
}
