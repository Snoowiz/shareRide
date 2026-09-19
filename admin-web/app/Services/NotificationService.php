<?php

namespace App\Services;

use App\Models\EmailLog;
use App\Models\EmailTemplate;
use App\Models\Supabase\Setting;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Symfony\Component\Mailer\Exception\TransportExceptionInterface;
use Throwable;

class NotificationService
{
    /**
     * Resolve and apply live SMTP configuration from Supabase settings or environment fallback.
     */
    public static function configureSmtp(?array $customConfig = null): array
    {
        $settings = [];
        try {
            $settings = \Illuminate\Support\Facades\Cache::remember('goride_smtp_settings', 300, function () {
                try {
                    return Setting::all()->pluck('value', 'key')->toArray();
                } catch (Throwable $inner) {
                    Log::warning('Setting::all() query failed, falling back to .env: ' . $inner->getMessage());
                    return [];
                }
            });
        } catch (Throwable $e) {
            Log::warning('Could not load SMTP settings from database: ' . $e->getMessage());
        }

        $host = $customConfig['smtp_host'] 
            ?? $settings['smtp_host'] 
            ?? config('mail.mailers.smtp.host', env('MAIL_HOST', '127.0.0.1'));

        $port = $customConfig['smtp_port'] 
            ?? $settings['smtp_port'] 
            ?? config('mail.mailers.smtp.port', env('MAIL_PORT', 2525));

        $username = $customConfig['smtp_username'] 
            ?? $settings['smtp_username'] 
            ?? config('mail.mailers.smtp.username', env('MAIL_USERNAME'));

        $password = $customConfig['smtp_password'] 
            ?? $settings['smtp_password'] 
            ?? config('mail.mailers.smtp.password', env('MAIL_PASSWORD'));

        $encryption = $customConfig['smtp_encryption'] 
            ?? $settings['smtp_encryption'] 
            ?? env('MAIL_ENCRYPTION', 'tls');

        $fromAddress = $customConfig['smtp_from_address'] 
            ?? $settings['smtp_from_address'] 
            ?? config('mail.from.address', env('MAIL_FROM_ADDRESS', 'no-reply@goride.app'));

        $fromName = $customConfig['smtp_from_name'] 
            ?? $settings['smtp_from_name'] 
            ?? config('mail.from.name', env('MAIL_FROM_NAME', 'GoRide'));

        $mailer = $customConfig['mail_mailer'] 
            ?? $settings['mail_mailer'] 
            ?? config('mail.default', env('MAIL_MAILER', 'smtp'));

        // Dynamically apply to Laravel runtime config
        Config::set('mail.default', $mailer);
        Config::set('mail.mailers.smtp.host', $host);
        Config::set('mail.mailers.smtp.port', (int) $port);
        Config::set('mail.mailers.smtp.username', $username);
        Config::set('mail.mailers.smtp.password', $password);
        Config::set('mail.mailers.smtp.encryption', $encryption === 'none' ? null : $encryption);
        Config::set('mail.mailers.smtp.timeout', 10);
        Config::set('mail.from.address', $fromAddress);
        Config::set('mail.from.name', $fromName);

        // Purge mailer instance to refresh connection settings
        Mail::purge('smtp');

        return [
            'mailer' => $mailer,
            'host' => $host,
            'port' => (int) $port,
            'username' => $username,
            'encryption' => $encryption,
            'from_address' => $fromAddress,
            'from_name' => $fromName,
        ];
    }

    /**
     * Send a raw transactional email and record the transaction in email_logs.
     */
    public static function sendEmail(
        string $toEmail,
        string $subject,
        string $htmlBody,
        ?string $textBody = null,
        array $metadata = [],
        ?string $recipientName = null,
        ?string $templateKey = null,
        ?array $smtpOverrides = null
    ): array {
        $config = self::configureSmtp($smtpOverrides);

        // Create initial pending log
        $log = EmailLog::create([
            'recipient_email' => $toEmail,
            'recipient_name' => $recipientName,
            'subject' => $subject,
            'template_key' => $templateKey,
            'status' => 'queued',
            'rendered_body' => $htmlBody,
            'metadata' => array_merge($metadata, ['smtp_host' => $config['host'], 'smtp_port' => $config['port']]),
        ]);

        try {
            Mail::html($htmlBody, function ($message) use ($toEmail, $recipientName, $subject, $config, $textBody) {
                $message->to($toEmail, $recipientName ?: null)
                    ->subject($subject)
                    ->from($config['from_address'], $config['from_name']);

                if ($textBody) {
                    $message->text($textBody);
                }
            });

            $log->update([
                'status' => 'sent',
                'sent_at' => now(),
            ]);

            return [
                'success' => true,
                'message' => "Email sent successfully to {$toEmail}",
                'log_id' => $log->id,
            ];
        } catch (TransportExceptionInterface $te) {
            $errorMessage = "SMTP Transport Error: " . $te->getMessage();
            Log::error($errorMessage, ['recipient' => $toEmail, 'subject' => $subject]);

            $log->update([
                'status' => 'failed',
                'error_message' => $errorMessage,
            ]);

            return [
                'success' => false,
                'message' => $errorMessage,
                'log_id' => $log->id,
            ];
        } catch (Throwable $e) {
            $errorMessage = "Mail Error: " . $e->getMessage();
            Log::error($errorMessage, ['recipient' => $toEmail, 'subject' => $subject]);

            $log->update([
                'status' => 'failed',
                'error_message' => $errorMessage,
            ]);

            return [
                'success' => false,
                'message' => $errorMessage,
                'log_id' => $log->id,
            ];
        }
    }

    /**
     * Send an email using a registered template with dynamic variable replacements.
     */
    public static function sendTemplate(
        string $templateKey,
        string $toEmail,
        array $variables = [],
        ?string $overrideSubject = null,
        ?string $recipientName = null,
        ?array $smtpOverrides = null
    ): array {
        $template = EmailTemplate::where('key', $templateKey)->first();

        if (!$template) {
            return [
                'success' => false,
                'message' => "Email template '{$templateKey}' was not found in the database.",
            ];
        }

        if (!$template->is_active) {
            return [
                'success' => false,
                'message' => "Email template '{$templateKey}' is currently marked as inactive.",
            ];
        }

        // Add common fallback variables
        $variables['app_name'] = $variables['app_name'] ?? 'GoRide';
        $variables['support_email'] = $variables['support_email'] ?? 'support@goride.app';
        $variables['current_year'] = $variables['current_year'] ?? date('Y');

        $rendered = $template->render($variables);
        $subject = $overrideSubject ?: $rendered['subject'];

        return self::sendEmail(
            toEmail: $toEmail,
            subject: $subject,
            htmlBody: $rendered['html'],
            textBody: $rendered['text'],
            metadata: ['template_key' => $templateKey, 'variables' => $variables],
            recipientName: $recipientName ?? ($variables['user_name'] ?? null),
            templateKey: $templateKey,
            smtpOverrides: $smtpOverrides
        );
    }

    /**
     * Send a password reset transactional email.
     */
    public static function sendPasswordReset(
        string $email,
        string $name,
        string $resetUrl,
        string $otpCode = '',
        int $expiryMinutes = 30
    ): array {
        return self::sendTemplate(
            templateKey: 'password_reset',
            toEmail: $email,
            variables: [
                'user_name' => $name,
                'reset_link' => $resetUrl,
                'otp_code' => $otpCode ?: '------',
                'expiry_minutes' => $expiryMinutes,
                'support_email' => 'support@goride.app',
            ],
            recipientName: $name
        );
    }

    /**
     * Send a ride update transactional email (e-receipt, driver arrival, cancellation).
     */
    public static function sendRideUpdate(
        string $email,
        string $name,
        array $rideData
    ): array {
        return self::sendTemplate(
            templateKey: 'ride_update',
            toEmail: $email,
            variables: [
                'user_name' => $name,
                'ride_id' => substr((string) ($rideData['id'] ?? '00000000'), 0, 8),
                'status' => strtoupper((string) ($rideData['status'] ?? 'UPDATED')),
                'driver_name' => $rideData['driver_name'] ?? 'GoRide Captain',
                'pickup_location' => $rideData['pickup_location'] ?? 'Pickup Point',
                'destination_location' => $rideData['destination_location'] ?? 'Drop-off Point',
                'fare' => number_format((float) ($rideData['fare'] ?? 0), 2),
                'payment_method' => ucfirst((string) ($rideData['payment_method'] ?? 'Wallet')),
            ],
            recipientName: $name
        );
    }

    /**
     * Send support ticket receipt confirmation email.
     */
    public static function sendComplaintConfirmation(
        string $email,
        string $name,
        array $ticketData
    ): array {
        return self::sendTemplate(
            templateKey: 'complaint_received',
            toEmail: $email,
            variables: [
                'user_name' => $name,
                'ticket_id' => substr((string) ($ticketData['id'] ?? '00000000'), 0, 8),
                'ticket_subject' => $ticketData['subject'] ?? 'Support Inquiry',
                'ticket_category' => $ticketData['category'] ?? 'General',
                'support_url' => 'goride://support/' . ($ticketData['id'] ?? ''),
            ],
            recipientName: $name
        );
    }

    /**
     * Send support ticket reply/resolution email.
     */
    public static function sendComplaintReply(
        string $email,
        string $name,
        array $ticketData,
        string $replyMessage,
        string $status = 'Updated'
    ): array {
        return self::sendTemplate(
            templateKey: 'complaint_resolved',
            toEmail: $email,
            variables: [
                'user_name' => $name,
                'ticket_id' => substr((string) ($ticketData['id'] ?? '00000000'), 0, 8),
                'admin_response' => $replyMessage,
                'ticket_status' => ucfirst($status),
            ],
            recipientName: $name
        );
    }

    /**
     * Send an admin broadcast announcement.
     */
    public static function sendAnnouncement(
        array $recipients,
        string $title,
        string $body,
        ?string $actionUrl = null,
        ?string $actionText = null
    ): array {
        $sentCount = 0;
        $failCount = 0;

        foreach ($recipients as $recipient) {
            $email = is_array($recipient) ? ($recipient['email'] ?? null) : $recipient;
            $name = is_array($recipient) ? ($recipient['name'] ?? 'User') : 'Valued Rider';

            if (!$email || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
                $failCount++;
                continue;
            }

            $res = self::sendTemplate(
                templateKey: 'admin_announcement',
                toEmail: $email,
                variables: [
                    'user_name' => $name,
                    'announcement_title' => $title,
                    'announcement_body' => nl2br(e($body)),
                    'action_button_text' => $actionText ?: 'Open GoRide App',
                    'action_button_url' => $actionUrl ?: 'https://goride.app',
                ],
                recipientName: $name
            );

            if ($res['success']) {
                $sentCount++;
            } else {
                $failCount++;
            }
        }

        return [
            'success' => $sentCount > 0 || count($recipients) === 0,
            'total' => count($recipients),
            'sent' => $sentCount,
            'failed' => $failCount,
        ];
    }

    /**
     * Test SMTP connectivity and send a live diagnostic email.
     */
    public static function testSmtpConnection(string $testRecipientEmail, ?array $overrideConfig = null): array
    {
        $config = self::configureSmtp($overrideConfig);

        $diagnosticSubject = "GoRide SMTP Diagnostic Test - " . date('Y-m-d H:i:s');
        $diagnosticHtml = '<div style="font-family: Arial, sans-serif; max-width: 540px; margin: 0 auto; border: 1px solid #CBD5E1; border-radius: 8px; overflow: hidden;">
            <div style="background: #0F346E; padding: 20px; text-align: center; color: white;">
                <h2 style="margin: 0;">GoRide SMTP Connectivity Test</h2>
            </div>
            <div style="padding: 24px; color: #1E293B;">
                <p>Hello Administrator,</p>
                <p>Your SMTP email configuration has been <strong>successfully verified</strong> and is fully operational!</p>
                <div style="background: #F8FAFC; padding: 14px; border-radius: 6px; font-family: monospace; font-size: 13px; line-height: 1.6;">
                    <strong>Host:</strong> ' . htmlspecialchars($config['host']) . '<br>
                    <strong>Port:</strong> ' . htmlspecialchars((string) $config['port']) . '<br>
                    <strong>Encryption:</strong> ' . htmlspecialchars((string) ($config['encryption'] ?? 'none')) . '<br>
                    <strong>From:</strong> ' . htmlspecialchars($config['from_name']) . ' &lt;' . htmlspecialchars($config['from_address']) . '&gt;<br>
                    <strong>Timestamp:</strong> ' . date('c') . '
                </div>
                <p style="margin-top: 18px; font-size: 13px; color: #64748B;">This diagnostic message confirms that your GoRide transactional notification system can dispatch emails reliably.</p>
            </div>
        </div>';

        return self::sendEmail(
            toEmail: $testRecipientEmail,
            subject: $diagnosticSubject,
            htmlBody: $diagnosticHtml,
            textBody: "GoRide SMTP Diagnostic Test: Connectivity verified successfully at " . date('c'),
            metadata: ['type' => 'smtp_diagnostic_test', 'config' => $config],
            recipientName: 'GoRide Administrator',
            templateKey: null,
            smtpOverrides: $overrideConfig
        );
    }
}
