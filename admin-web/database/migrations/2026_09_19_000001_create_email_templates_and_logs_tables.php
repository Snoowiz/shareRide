<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::connection('mysql')->create('email_templates', function (Blueprint $table) {
            $table->id();
            $table->string('key', 50)->unique();
            $table->string('name', 100);
            $table->string('subject', 255);
            $table->longText('body_html');
            $table->text('body_text')->nullable();
            $table->json('variables')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::connection('mysql')->create('email_logs', function (Blueprint $table) {
            $table->id();
            $table->string('recipient_email', 255)->index();
            $table->string('recipient_name', 255)->nullable();
            $table->string('subject', 255);
            $table->string('template_key', 50)->nullable()->index();
            $table->enum('status', ['sent', 'failed', 'queued'])->default('queued')->index();
            $table->text('error_message')->nullable();
            $table->longText('rendered_body')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamp('sent_at')->nullable();
            $table->timestamps();
        });

        // Seed default pre-built templates
        $now = now();
        $templates = [
            [
                'key' => 'password_reset',
                'name' => 'Password Reset',
                'subject' => 'GoRide - Reset Your Password',
                'variables' => json_encode(['user_name', 'reset_link', 'otp_code', 'expiry_minutes', 'support_email']),
                'is_active' => true,
                'body_text' => "Hello {{user_name}},\n\nWe received a request to reset your GoRide password.\n\nUse this link: {{reset_link}}\nOr enter code: {{otp_code}}\n\nThis link will expire in {{expiry_minutes}} minutes. If you did not request this, please ignore this email.\n\nGoRide Support: {{support_email}}",
                'body_html' => '<div style="font-family: \'Segoe UI\', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #E2E8F0;">
    <div style="background: #0F346E; padding: 28px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.5px;">Go<span style="color: #FCCA14;">Ride</span></h1>
        <p style="color: #CBD5E1; margin: 6px 0 0 0; font-size: 13px;">Fast, Reliable Rides & Deliveries</p>
    </div>
    <div style="padding: 32px 28px;">
        <h2 style="color: #0F172A; margin: 0 0 16px 0; font-size: 20px;">Password Reset Request</h2>
        <p style="color: #475569; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">Hello <strong>{{user_name}}</strong>,</p>
        <p style="color: #475569; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0;">We received a request to reset the password for your GoRide account. Click the button below or enter the security code to choose a new password:</p>
        <div style="text-align: center; margin: 28px 0;">
            <a href="{{reset_link}}" style="background: #0F346E; color: #ffffff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 15px; display: inline-block;">Reset Password</a>
        </div>
        <div style="background: #F8FAFC; border: 1px dashed #CBD5E1; border-radius: 8px; padding: 16px; text-align: center; margin: 24px 0;">
            <span style="display: block; font-size: 12px; color: #64748B; font-weight: 600; text-transform: uppercase;">Verification Code</span>
            <span style="display: block; font-size: 24px; font-weight: 800; color: #0F346E; letter-spacing: 4px; margin-top: 4px;">{{otp_code}}</span>
        </div>
        <p style="color: #64748B; font-size: 13px; line-height: 1.5; margin: 0;">This security code and link will expire in <strong>{{expiry_minutes}} minutes</strong>. If you did not make this request, your account is safe and you can safely disregard this message.</p>
    </div>
    <div style="background: #F1F5F9; padding: 20px 28px; text-align: center; border-top: 1px solid #E2E8F0;">
        <p style="color: #94A3B8; font-size: 12px; margin: 0;">Need assistance? Reach out to <a href="mailto:{{support_email}}" style="color: #0F346E; text-decoration: none; font-weight: 600;">{{support_email}}</a></p>
        <p style="color: #94A3B8; font-size: 11px; margin: 6px 0 0 0;">&copy; ' . date('Y') . ' GoRide Technologies Ltd. All rights reserved.</p>
    </div>
</div>',
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'key' => 'ride_update',
                'name' => 'Ride Status & E-Receipt',
                'subject' => 'GoRide - Ride Update: {{status}} (#{{ride_id}})',
                'variables' => json_encode(['user_name', 'ride_id', 'status', 'driver_name', 'pickup_location', 'destination_location', 'fare', 'payment_method']),
                'is_active' => true,
                'body_text' => "Hello {{user_name}},\n\nYour ride #{{ride_id}} status is now: {{status}}.\nDriver: {{driver_name}}\nPickup: {{pickup_location}}\nDestination: {{destination_location}}\nTotal Fare: {{fare}}\nPayment: {{payment_method}}\n\nThank you for riding with GoRide!",
                'body_html' => '<div style="font-family: \'Segoe UI\', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #E2E8F0;">
    <div style="background: #0F346E; padding: 28px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: 800;">Go<span style="color: #FCCA14;">Ride</span></h1>
        <p style="color: #CBD5E1; margin: 6px 0 0 0; font-size: 13px;">Ride Status Update</p>
    </div>
    <div style="padding: 32px 28px;">
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #F1F5F9; padding-bottom: 16px; margin-bottom: 20px;">
            <div>
                <span style="font-size: 12px; color: #64748B; text-transform: uppercase; font-weight: 600;">Ride ID</span>
                <p style="font-size: 16px; font-weight: 700; color: #0F172A; margin: 2px 0 0 0;">#{{ride_id}}</p>
            </div>
            <div style="text-align: right;">
                <span style="background: #FCCA14; color: #0F346E; font-weight: 800; padding: 6px 14px; border-radius: 20px; font-size: 13px; text-transform: uppercase;">{{status}}</span>
            </div>
        </div>
        <p style="color: #475569; font-size: 15px; margin: 0 0 20px 0;">Hello <strong>{{user_name}}</strong>, here are the current details for your journey:</p>
        <div style="background: #F8FAFC; border-radius: 8px; padding: 18px; margin-bottom: 24px;">
            <div style="margin-bottom: 12px;">
                <strong style="color: #64748B; font-size: 12px; text-transform: uppercase;">Assigned Driver:</strong>
                <p style="color: #0F172A; font-size: 15px; font-weight: 600; margin: 2px 0 0 0;">{{driver_name}}</p>
            </div>
            <div style="margin-bottom: 12px;">
                <strong style="color: #64748B; font-size: 12px; text-transform: uppercase;">Pickup:</strong>
                <p style="color: #0F172A; font-size: 14px; margin: 2px 0 0 0;">{{pickup_location}}</p>
            </div>
            <div style="margin-bottom: 12px;">
                <strong style="color: #64748B; font-size: 12px; text-transform: uppercase;">Destination:</strong>
                <p style="color: #0F172A; font-size: 14px; margin: 2px 0 0 0;">{{destination_location}}</p>
            </div>
            <div style="border-top: 1px solid #E2E8F0; padding-top: 12px; display: flex; justify-content: space-between;">
                <span style="color: #0F172A; font-weight: 700; font-size: 16px;">Total Fare:</span>
                <span style="color: #0F346E; font-weight: 800; font-size: 18px;">₦{{fare}}</span>
            </div>
            <div style="margin-top: 6px; font-size: 12px; color: #64748B; text-align: right;">
                Payment Method: <strong>{{payment_method}}</strong>
            </div>
        </div>
        <p style="color: #64748B; font-size: 13px; line-height: 1.5; margin: 0;">You can view live route progress, driver contact, and safety features directly in the GoRide mobile app.</p>
    </div>
    <div style="background: #F1F5F9; padding: 20px 28px; text-align: center; border-top: 1px solid #E2E8F0;">
        <p style="color: #94A3B8; font-size: 11px; margin: 0;">&copy; ' . date('Y') . ' GoRide Technologies Ltd. All rights reserved.</p>
    </div>
</div>',
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'key' => 'complaint_received',
                'name' => 'Support Ticket Received',
                'subject' => 'GoRide Support - Ticket #{{ticket_id}} Received',
                'variables' => json_encode(['user_name', 'ticket_id', 'ticket_subject', 'ticket_category', 'support_url']),
                'is_active' => true,
                'body_text' => "Hello {{user_name}},\n\nWe have received your support request regarding \"{{ticket_subject}}\" (Ticket #{{ticket_id}}).\n\nCategory: {{ticket_category}}\n\nOur customer operations team is reviewing your ticket and will respond shortly. You can monitor your ticket here: {{support_url}}\n\nGoRide Support Team",
                'body_html' => '<div style="font-family: \'Segoe UI\', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #E2E8F0;">
    <div style="background: #0F346E; padding: 28px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: 800;">Go<span style="color: #FCCA14;">Ride</span></h1>
        <p style="color: #CBD5E1; margin: 6px 0 0 0; font-size: 13px;">Customer Support Desk</p>
    </div>
    <div style="padding: 32px 28px;">
        <h2 style="color: #0F172A; margin: 0 0 14px 0; font-size: 20px;">We Received Your Support Ticket</h2>
        <p style="color: #475569; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">Hello <strong>{{user_name}}</strong>,</p>
        <p style="color: #475569; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">Thank you for contacting GoRide Support. Your issue has been logged into our support queue with reference number <strong>#{{ticket_id}}</strong>.</p>
        <div style="background: #F8FAFC; border-left: 4px solid #0F346E; border-radius: 4px; padding: 16px; margin: 20px 0;">
            <p style="margin: 0 0 6px 0; font-size: 14px; color: #1E293B;"><strong>Subject:</strong> {{ticket_subject}}</p>
            <p style="margin: 0; font-size: 13px; color: #64748B;"><strong>Category:</strong> {{ticket_category}}</p>
        </div>
        <p style="color: #475569; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0;">Our support specialists are investigating the matter and will reply directly in your app. You can also monitor updates anytime:</p>
        <div style="text-align: center; margin: 24px 0;">
            <a href="{{support_url}}" style="background: #0F346E; color: #ffffff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 14px; display: inline-block;">View Ticket in App</a>
        </div>
    </div>
    <div style="background: #F1F5F9; padding: 20px 28px; text-align: center; border-top: 1px solid #E2E8F0;">
        <p style="color: #94A3B8; font-size: 11px; margin: 0;">&copy; ' . date('Y') . ' GoRide Technologies Ltd. All rights reserved.</p>
    </div>
</div>',
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'key' => 'complaint_resolved',
                'name' => 'Support Ticket Response / Resolved',
                'subject' => 'GoRide Support - Update on Ticket #{{ticket_id}}',
                'variables' => json_encode(['user_name', 'ticket_id', 'admin_response', 'ticket_status']),
                'is_active' => true,
                'body_text' => "Hello {{user_name}},\n\nThere is an official response on your support ticket #{{ticket_id}} (Status: {{ticket_status}}):\n\n\"{{admin_response}}\"\n\nIf you have further questions, reply in the app.\n\nGoRide Support",
                'body_html' => '<div style="font-family: \'Segoe UI\', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #E2E8F0;">
    <div style="background: #0F346E; padding: 28px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: 800;">Go<span style="color: #FCCA14;">Ride</span></h1>
        <p style="color: #CBD5E1; margin: 6px 0 0 0; font-size: 13px;">Customer Support Desk</p>
    </div>
    <div style="padding: 32px 28px;">
        <h2 style="color: #0F172A; margin: 0 0 14px 0; font-size: 20px;">Support Ticket Update</h2>
        <p style="color: #475569; font-size: 15px; margin: 0 0 16px 0;">Hello <strong>{{user_name}}</strong>,</p>
        <p style="color: #475569; font-size: 15px; margin: 0 0 20px 0;">Our support representative has reviewed and updated your ticket <strong>#{{ticket_id}}</strong> (Status: <strong>{{ticket_status}}</strong>):</p>
        <div style="background: #F8FAFC; border: 1px solid #CBD5E1; border-radius: 8px; padding: 18px; margin: 20px 0;">
            <span style="font-size: 12px; color: #64748B; font-weight: 700; text-transform: uppercase;">Official Response:</span>
            <p style="font-size: 15px; color: #0F172A; line-height: 1.6; margin: 8px 0 0 0;">{{admin_response}}</p>
        </div>
        <p style="color: #64748B; font-size: 13px; line-height: 1.5; margin: 0;">If your issue has been resolved, thank you for your patience. If you still need help, feel free to reopen or reply directly from the GoRide Support screen.</p>
    </div>
    <div style="background: #F1F5F9; padding: 20px 28px; text-align: center; border-top: 1px solid #E2E8F0;">
        <p style="color: #94A3B8; font-size: 11px; margin: 0;">&copy; ' . date('Y') . ' GoRide Technologies Ltd. All rights reserved.</p>
    </div>
</div>',
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'key' => 'admin_announcement',
                'name' => 'Platform Announcement',
                'subject' => '{{announcement_title}} - GoRide Update',
                'variables' => json_encode(['user_name', 'announcement_title', 'announcement_body', 'action_button_text', 'action_button_url']),
                'is_active' => true,
                'body_text' => "Hello {{user_name}},\n\n{{announcement_title}}\n\n{{announcement_body}}\n\n{{action_button_text}}: {{action_button_url}}\n\nBest regards,\nGoRide Team",
                'body_html' => '<div style="font-family: \'Segoe UI\', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #E2E8F0;">
    <div style="background: #0F346E; padding: 28px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: 800;">Go<span style="color: #FCCA14;">Ride</span></h1>
        <p style="color: #CBD5E1; margin: 6px 0 0 0; font-size: 13px;">Official Community Announcement</p>
    </div>
    <div style="padding: 32px 28px;">
        <h2 style="color: #0F172A; margin: 0 0 16px 0; font-size: 22px;">{{announcement_title}}</h2>
        <p style="color: #475569; font-size: 15px; margin: 0 0 16px 0;">Hello <strong>{{user_name}}</strong>,</p>
        <div style="color: #334155; font-size: 15px; line-height: 1.7; margin: 0 0 28px 0;">
            {{announcement_body}}
        </div>
        <div style="text-align: center; margin: 24px 0;">
            <a href="{{action_button_url}}" style="background: #FCCA14; color: #0F346E; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 800; font-size: 15px; display: inline-block;">{{action_button_text}}</a>
        </div>
    </div>
    <div style="background: #F1F5F9; padding: 20px 28px; text-align: center; border-top: 1px solid #E2E8F0;">
        <p style="color: #94A3B8; font-size: 11px; margin: 0;">&copy; ' . date('Y') . ' GoRide Technologies Ltd. All rights reserved.</p>
    </div>
</div>',
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'key' => 'welcome_email',
                'name' => 'Welcome to GoRide',
                'subject' => 'Welcome to GoRide, {{user_name}}!',
                'variables' => json_encode(['user_name', 'role', 'login_url', 'app_name']),
                'is_active' => true,
                'body_text' => "Welcome {{user_name}} to {{app_name}}!\n\nYou are registered as a {{role}}.\n\nOpen the app to get started: {{login_url}}\n\nSafe travels,\nGoRide Team",
                'body_html' => '<div style="font-family: \'Segoe UI\', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #E2E8F0;">
    <div style="background: #0F346E; padding: 28px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: 800;">Go<span style="color: #FCCA14;">Ride</span></h1>
        <p style="color: #CBD5E1; margin: 6px 0 0 0; font-size: 13px;">Welcome to the Platform</p>
    </div>
    <div style="padding: 32px 28px;">
        <h2 style="color: #0F172A; margin: 0 0 16px 0; font-size: 22px;">Welcome to GoRide, {{user_name}}!</h2>
        <p style="color: #475569; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">We are thrilled to welcome you to the GoRide network as a <strong>{{role}}</strong>. Whether you need seamless city transportation, fast package delivery, or flexible earnings on your schedule, GoRide has you covered.</p>
        <div style="background: #F8FAFC; border-radius: 8px; padding: 18px; margin: 24px 0;">
            <p style="margin: 0 0 8px 0; font-size: 14px; font-weight: 700; color: #0F172A;">Getting Started:</p>
            <ul style="margin: 0; padding-left: 20px; font-size: 14px; color: #475569; line-height: 1.6;">
                <li>Complete your profile & verify phone number</li>
                <li>Set up your preferred payment method or top up your wallet</li>
                <li>Enjoy real-time trip tracking & 24/7 dedicated support</li>
            </ul>
        </div>
        <div style="text-align: center; margin: 28px 0;">
            <a href="{{login_url}}" style="background: #0F346E; color: #ffffff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 15px; display: inline-block;">Open GoRide</a>
        </div>
    </div>
    <div style="background: #F1F5F9; padding: 20px 28px; text-align: center; border-top: 1px solid #E2E8F0;">
        <p style="color: #94A3B8; font-size: 11px; margin: 0;">&copy; ' . date('Y') . ' GoRide Technologies Ltd. All rights reserved.</p>
    </div>
</div>',
                'created_at' => $now,
                'updated_at' => $now,
            ],
        ];

        DB::connection('mysql')->table('email_templates')->insert($templates);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::connection('mysql')->dropIfExists('email_logs');
        Schema::connection('mysql')->dropIfExists('email_templates');
    }
};
