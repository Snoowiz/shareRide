<?php

namespace App\Filament\Resources\EmailTemplateResource\Pages;

use App\Filament\Resources\EmailTemplateResource;
use App\Models\EmailTemplate;
use App\Services\NotificationService;
use Filament\Actions;
use Filament\Forms;
use Filament\Notifications\Notification;
use Filament\Resources\Pages\EditRecord;

class EditEmailTemplate extends EditRecord
{
    protected static string $resource = EmailTemplateResource::class;

    protected function getHeaderActions(): array
    {
        return [
            Actions\Action::make('testSend')
                ->label('Send Test Email')
                ->icon('heroicon-o-paper-airplane')
                ->color('info')
                ->modalHeading(fn (EmailTemplate $record) => "Send Test Email: {$record->name}")
                ->modalDescription('Dispatches a live test email using this template with sample data.')
                ->form([
                    Forms\Components\TextInput::make('recipient_email')
                        ->label('Recipient Email Address')
                        ->email()
                        ->required()
                        ->default(auth()->user()?->email ?? 'admin@goride.app'),
                ])
                ->action(function (EmailTemplate $record, array $data) {
                    $sampleVariables = [
                        'user_name' => 'GoRide Sample User',
                        'reset_link' => 'https://goride.app/reset-sample',
                        'otp_code' => '849201',
                        'expiry_minutes' => 30,
                        'ride_id' => 'RD-92810',
                        'status' => 'COMPLETED',
                        'driver_name' => 'Captain Michael',
                        'pickup_location' => 'Central Business District, Lagos',
                        'destination_location' => 'Victoria Island, Lagos',
                        'fare' => '3,500.00',
                        'payment_method' => 'Wallet',
                        'ticket_id' => 'TCK-4091',
                        'ticket_subject' => 'Billing inquiry regarding recent trip',
                        'ticket_category' => 'Billing',
                        'support_url' => 'goride://support/TCK-4091',
                        'admin_response' => 'We have investigated your trip and credited the fare discrepancy back to your wallet balance. Thank you for your patience.',
                        'ticket_status' => 'Resolved',
                        'announcement_title' => 'Important Service Expansion Update',
                        'announcement_body' => 'We are excited to announce 24/7 delivery services and expanded coverage zones across the metropolitan area!',
                        'action_button_text' => 'Explore Zones',
                        'action_button_url' => 'https://goride.app',
                        'role' => 'Rider',
                        'login_url' => 'https://goride.app',
                        'app_name' => 'GoRide',
                        'support_email' => 'support@goride.app',
                    ];

                    $result = NotificationService::sendTemplate(
                        templateKey: $record->key,
                        toEmail: $data['recipient_email'],
                        variables: $sampleVariables,
                        recipientName: 'Test Recipient'
                    );

                    if ($result['success']) {
                        Notification::make()
                            ->title('Test Email Dispatched!')
                            ->body("Successfully sent '{$record->name}' to {$data['recipient_email']}.")
                            ->success()
                            ->send();
                    } else {
                        Notification::make()
                            ->title('Delivery Failed')
                            ->body($result['message'])
                            ->danger()
                            ->persistent()
                            ->send();
                    }
                }),
        ];
    }
}
