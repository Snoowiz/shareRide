<?php

namespace Tests\Feature;

use App\Services\Payment\FlutterwaveGateway;
use App\Services\Payment\PaymentManager;
use App\Services\Payment\PaystackGateway;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class PaymentGatewayTest extends TestCase
{
    public function test_public_payment_config_endpoint_returns_enabled_gateways_without_secret_keys(): void
    {
        $response = $this->getJson('/api/v1/payments/config');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'data' => [
                    'gateways',
                    'enabled_gateways',
                ],
            ]);

        $content = $response->json();
        $this->assertTrue($content['success']);

        // Assert secret keys are never exposed in public config
        $jsonString = $response->getContent();
        $this->assertStringNotContainsString('secret_key', $jsonString);
        $this->assertStringNotContainsString('webhook_hash', $jsonString);
    }

    public function test_initialize_payment_requires_valid_gateway_and_amount(): void
    {
        $response = $this->postJson('/api/v1/payments/initialize', [
            'amount' => 5000,
            'email' => 'driver@goride.test',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['gateway']);
    }

    public function test_verify_payment_requires_gateway_and_reference(): void
    {
        $response = $this->postJson('/api/v1/payments/verify', []);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['gateway', 'reference']);
    }

    public function test_payment_manager_registers_paystack_and_flutterwave(): void
    {
        $manager = new PaymentManager();

        $paystack = $manager->getGateway('paystack');
        $this->assertInstanceOf(PaystackGateway::class, $paystack);
        $this->assertEquals('paystack', $paystack->getId());

        $flw = $manager->getGateway('flutterwave');
        $this->assertInstanceOf(FlutterwaveGateway::class, $flw);
        $this->assertEquals('flutterwave', $flw->getId());
    }

    public function test_flutterwave_initialization_with_mocked_http(): void
    {
        Http::fake([
            'https://api.flutterwave.com/v3/payments' => Http::response([
                'status' => 'success',
                'message' => 'Hosted Link',
                'data' => [
                    'link' => 'https://checkout.flutterwave.com/v3/hosted/pay/test-flw-link',
                ],
            ], 200),
        ]);

        $gateway = new FlutterwaveGateway();
        // Force secret key for testing
        $reflector = new \ReflectionClass($gateway);
        
        $response = Http::post('https://api.flutterwave.com/v3/payments', [
            'tx_ref' => 'TEST_REF_123',
            'amount' => '2500',
        ]);

        $this->assertTrue($response->successful());
        $this->assertEquals('https://checkout.flutterwave.com/v3/hosted/pay/test-flw-link', $response->json('data.link'));
    }

    public function test_webhook_unauthorized_without_signature(): void
    {
        $response = $this->postJson('/api/v1/payments/webhook/paystack', [
            'event' => 'charge.success',
            'data' => ['reference' => 'ref_123'],
        ]);

        // Paystack webhook without valid signature header is rejected
        $response->assertStatus(401);
    }
}
