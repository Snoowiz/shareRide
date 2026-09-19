<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class ExpoPushService
{
    public static function sendPushNotification(string $expoPushToken, string $title, string $body, array $data = [])
    {
        $url = env('EXPO_PUSH_URL', 'https://exp.host/--/api/v2/push/send');

        if (!str_starts_with($expoPushToken, 'ExponentPushToken')) {
            Log::warning('Invalid Expo Push Token: ' . $expoPushToken);
            return false;
        }

        // Construct deep-linking URL if applicable
        if (isset($data['route'])) {
            $data['url'] = 'goride://' . ltrim($data['route'], '/');
        } elseif (isset($data['ride_id'])) {
            $data['url'] = 'goride://ride/' . $data['ride_id'];
        } elseif (isset($data['delivery_id'])) {
            $data['url'] = 'goride://delivery/' . $data['delivery_id'];
        } elseif (isset($data['support_ticket_id'])) {
            $data['url'] = 'goride://support/' . $data['support_ticket_id'];
        }

        $payload = [
            'to' => $expoPushToken,
            'sound' => 'default',
            'title' => $title,
            'body' => $body,
            'data' => $data,
        ];

        $response = Http::withHeaders([
            'Accept' => 'application/json',
            'Accept-encoding' => 'gzip, deflate',
            'Content-Type' => 'application/json',
        ])->post($url, $payload);

        if ($response->successful()) {
            return $response->json();
        }

        Log::error('Expo Push Error', ['response' => $response->body()]);
        return false;
    }
}
