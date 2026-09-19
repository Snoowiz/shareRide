<?php

namespace Tests\Feature;

use Tests\TestCase;

class NotificationApiTest extends TestCase
{
    protected string $apiKey = 'goride_secure_notification_secret_2026';

    public function test_notification_health_check_returns_operational_status(): void
    {
        $response = $this->getJson('/api/v1/notifications/health');

        $response->assertStatus(200)
            ->assertJson([
                'status' => 'operational',
                'service' => 'GoRide Centralized Notification Service',
            ]);
    }

    public function test_unauthenticated_request_is_rejected(): void
    {
        $response = $this->postJson('/api/v1/notifications/password-reset', [
            'email' => 'unauth@goride.test',
        ]);

        $response->assertStatus(401)
            ->assertJson([
                'success' => false,
            ]);
    }

    public function test_password_reset_notification_endpoint(): void
    {
        $response = $this->withHeaders(['X-GoRide-Key' => $this->apiKey])
            ->postJson('/api/v1/notifications/password-reset', [
                'email' => 'rider@goride.test',
                'name' => 'Jordan Rider',
                'otp_code' => '418290',
                'reset_link' => 'https://goride.app/reset?token=xyz987',
            ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
            ]);
    }

    public function test_complaint_received_notification_endpoint(): void
    {
        $response = $this->withHeaders(['X-GoRide-Key' => $this->apiKey])
            ->postJson('/api/v1/notifications/complaint-received', [
                'email' => 'complaint@goride.test',
                'name' => 'Sara Connor',
                'ticket_id' => 'TCK-8821',
                'ticket_subject' => 'Late parcel delivery inquiry',
                'ticket_category' => 'Delivery Delay',
            ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
            ]);
    }

    public function test_ride_update_notification_endpoint(): void
    {
        $response = $this->withHeaders(['X-GoRide-Key' => $this->apiKey])
            ->postJson('/api/v1/notifications/ride-update', [
                'email' => 'rider_trip@goride.test',
                'name' => 'David Lee',
                'ride_id' => 'RIDE-99120',
                'status' => 'COMPLETED',
                'driver_name' => 'Captain Ibrahim',
                'pickup_location' => 'Ikeja City Mall',
                'destination_location' => 'Murtala Muhammed Airport',
                'fare' => 4500,
                'payment_method' => 'Paystack',
            ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
            ]);
    }

    public function test_send_template_universal_endpoint(): void
    {
        $response = $this->withHeaders(['X-GoRide-Key' => $this->apiKey])
            ->postJson('/api/v1/notifications/send-template', [
                'template_key' => 'welcome_email',
                'to_email' => 'captain_welcome@goride.test',
                'recipient_name' => 'Captain Jack',
                'variables' => [
                    'user_name' => 'Captain Jack',
                    'role' => 'Driver',
                    'login_url' => 'https://goride.app/login',
                ],
            ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
            ]);
    }
}
