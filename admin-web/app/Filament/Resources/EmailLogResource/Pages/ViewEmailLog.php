<?php

namespace App\Filament\Resources\EmailLogResource\Pages;

use App\Filament\Resources\EmailLogResource;
use App\Models\EmailLog;
use App\Services\NotificationService;
use Filament\Actions;
use Filament\Notifications\Notification;
use Filament\Resources\Pages\ViewRecord;

class ViewEmailLog extends ViewRecord
{
    protected static string $resource = EmailLogResource::class;

    protected function getHeaderActions(): array
    {
        return [
            Actions\Action::make('retry')
                ->label('Resend Email')
                ->icon('heroicon-o-arrow-path')
                ->color('warning')
                ->requiresConfirmation()
                ->modalHeading('Resend This Email')
                ->modalDescription(fn (EmailLog $record) => "Are you sure you want to re-dispatch this email to {$record->recipient_email}?")
                ->action(function (EmailLog $record) {
                    $res = NotificationService::sendEmail(
                        toEmail: $record->recipient_email,
                        subject: $record->subject,
                        htmlBody: $record->rendered_body ?: '<p>No content recorded</p>',
                        recipientName: $record->recipient_name,
                        templateKey: $record->template_key,
                        metadata: ['retried_from_log_id' => $record->id]
                    );

                    if ($res['success']) {
                        Notification::make()
                            ->title('Email Dispatched Successfully')
                            ->success()
                            ->send();
                    } else {
                        Notification::make()
                            ->title('Resend Attempt Failed')
                            ->body($res['message'])
                            ->danger()
                            ->send();
                    }
                }),
        ];
    }
}
