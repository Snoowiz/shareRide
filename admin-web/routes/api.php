<?php

use App\Models\EmailTemplate;
use App\Models\Supabase\Profile;
use App\Services\NotificationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Validator;

/*
|--------------------------------------------------------------------------
| GoRide Transactional Notification API Routes
|--------------------------------------------------------------------------
|
| Secure endpoints for triggering transactional notifications and emails
| from internal backend services, webhooks, or the Expo mobile app.
| Zero SMTP credentials touch the client application.
|
*/

use App\Http\Controllers\Api\PaymentController;
use App\Http\Middleware\VerifyNotificationApiKey;

/*
|--------------------------------------------------------------------------
| GoRide Unified Multi-Gateway Payment API Routes
|--------------------------------------------------------------------------
*/
Route::prefix('v1/payments')->group(function () {
    Route::get('/config', [PaymentController::class, 'config']);
    Route::post('/initialize', [PaymentController::class, 'initialize']);
    Route::post('/verify', [PaymentController::class, 'verify']);
    Route::post('/webhook/{gateway}', [PaymentController::class, 'webhook']);
});

Route::prefix('v1/notifications')->group(function () {
    // Health check and diagnostic status (Public status check)
    Route::get('/health', function () {
        $smtpConfig = NotificationService::configureSmtp();
        $templateCount = EmailTemplate::where('is_active', true)->count();

        return response()->json([
            'status' => 'operational',
            'service' => 'GoRide Centralized Notification Service',
            'mailer' => $smtpConfig['mailer'],
            'smtp_host' => $smtpConfig['host'],
            'smtp_port' => $smtpConfig['port'],
            'from_address' => $smtpConfig['from_address'],
            'active_templates' => $templateCount,
            'timestamp' => now()->toIso8601String(),
        ]);
    });

    // Authenticated endpoints
    Route::middleware([VerifyNotificationApiKey::class])->group(function () {

        // 1. Password Reset Transactional Email
        Route::post('/password-reset', function (Request $request) {
            $decoded = json_decode($request->getContent(), true);
            $input = is_array($decoded) ? array_merge($request->all(), $decoded) : $request->all();

            $validator = Validator::make($input, [
                'email' => 'required|email',
                'name' => 'nullable|string|max:100',
                'reset_link' => 'nullable|url',
                'otp_code' => 'nullable|string|max:10',
                'expiry_minutes' => 'nullable|integer|min:5|max:120',
            ]);

            if ($validator->fails()) {
                return response()->json(['success' => false, 'errors' => $validator->errors()], 422);
            }

            $email = strtolower(trim($input['email']));
            $name = $input['name'] ?? null;

            // If name is omitted, attempt resolving from profiles table
            if (empty($name)) {
                $profile = Profile::where('email', $email)->first();
                $name = $profile?->full_name ?: 'Valued User';
            }

            $resetUrl = $input['reset_link'] ?? 'https://goride.app/reset-password';
            $otpCode = $input['otp_code'] ?? '';
            $expiry = (int) ($input['expiry_minutes'] ?? 30);

            $result = NotificationService::sendPasswordReset(
                email: $email,
                name: $name,
                resetUrl: $resetUrl,
                otpCode: $otpCode,
                expiryMinutes: $expiry
            );

            return response()->json($result, $result['success'] ? 200 : 500);
        });

        // 2. Complaint / Support Ticket Confirmation Email
        Route::post('/complaint-received', function (Request $request) {
            $decoded = json_decode($request->getContent(), true);
            $input = is_array($decoded) ? array_merge($request->all(), $decoded) : $request->all();

            $validator = Validator::make($input, [
                'email' => 'required|email',
                'name' => 'nullable|string|max:100',
                'ticket_id' => 'required|string',
                'ticket_subject' => 'nullable|string|max:200',
                'ticket_category' => 'nullable|string|max:100',
            ]);

            if ($validator->fails()) {
                return response()->json(['success' => false, 'errors' => $validator->errors()], 422);
            }

            $email = strtolower(trim($input['email']));
            $name = $input['name'] ?? 'Valued User';

            $result = NotificationService::sendComplaintConfirmation(
                email: $email,
                name: $name,
                ticketData: [
                    'id' => $input['ticket_id'],
                    'subject' => $input['ticket_subject'] ?? 'Support Inquiry',
                    'category' => $input['ticket_category'] ?? 'General Support',
                ]
            );

            return response()->json($result, $result['success'] ? 200 : 500);
        });

        // 3. Ride Status / E-Receipt Update Email
        Route::post('/ride-update', function (Request $request) {
            $decoded = json_decode($request->getContent(), true);
            $input = is_array($decoded) ? array_merge($request->all(), $decoded) : $request->all();

            $validator = Validator::make($input, [
                'email' => 'required|email',
                'name' => 'nullable|string|max:100',
                'ride_id' => 'required|string',
                'status' => 'required|string',
                'driver_name' => 'nullable|string',
                'pickup_location' => 'nullable|string',
                'destination_location' => 'nullable|string',
                'fare' => 'nullable|numeric',
                'payment_method' => 'nullable|string',
            ]);

            if ($validator->fails()) {
                return response()->json(['success' => false, 'errors' => $validator->errors()], 422);
            }

            $result = NotificationService::sendRideUpdate(
                email: strtolower(trim($input['email'])),
                name: $input['name'] ?? 'Valued Rider',
                rideData: $input
            );

            return response()->json($result, $result['success'] ? 200 : 500);
        });

        // 4. Universal Send Template Endpoint
        Route::post('/send-template', function (Request $request) {
            $decoded = json_decode($request->getContent(), true);
            $input = is_array($decoded) ? array_merge($request->all(), $decoded) : $request->all();

            $validator = Validator::make($input, [
                'template_key' => 'required|string|exists:email_templates,key',
                'to_email' => 'required|email',
                'variables' => 'nullable|array',
                'override_subject' => 'nullable|string|max:255',
                'recipient_name' => 'nullable|string|max:100',
            ]);

            if ($validator->fails()) {
                return response()->json(['success' => false, 'errors' => $validator->errors()], 422);
            }

            $result = NotificationService::sendTemplate(
                templateKey: $input['template_key'],
                toEmail: strtolower(trim($input['to_email'])),
                variables: $input['variables'] ?? [],
                overrideSubject: $input['override_subject'] ?? null,
                recipientName: $input['recipient_name'] ?? null
            );

            return response()->json($result, $result['success'] ? 200 : 500);
        });
    });
});
