<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class VerifyNotificationApiKey
{
    /**
     * Handle an incoming request.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $expectedKey = env('GORIDE_NOTIFICATION_API_KEY', 'goride_secure_notification_secret_2026');
        $providedKey = $request->header('X-GoRide-Key') ?: $request->bearerToken();

        // Allow internal requests or requests matching secret key
        if ($providedKey && hash_equals($expectedKey, $providedKey)) {
            return $next($request);
        }

        // Allow requests matching Supabase anon key for mobile app interaction
        $supabaseAnon = env('SUPABASE_ANON_KEY');
        if ($providedKey && $supabaseAnon && hash_equals($supabaseAnon, $providedKey)) {
            return $next($request);
        }

        return response()->json([
            'success' => false,
            'error' => 'Unauthorized: Invalid or missing X-GoRide-Key authorization token.',
        ], 401);
    }
}
