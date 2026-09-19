<?php

namespace App\Filament\Resources\Supabase\Notifications\Pages;

use App\Filament\Resources\Supabase\Notifications\NotificationResource;
use App\Models\Supabase\PushToken;
use App\Services\ExpoPushService;
use Filament\Resources\Pages\CreateRecord;
use Illuminate\Support\Str;

class CreateNotification extends CreateRecord
{
    protected static string $resource = NotificationResource::class;

    protected function mutateFormDataBeforeCreate(array $data): array
    {
        $data['id'] = Str::uuid()->toString();
        $data['is_read'] = false;
        return $data;
    }

    protected function afterCreate(): void
    {
        $notification = $this->record;
        
        $tokens = PushToken::where('user_id', $notification->user_id)
            ->where('is_active', true)
            ->pluck('token');
            
        foreach ($tokens as $token) {
            ExpoPushService::sendPushNotification(
                $token,
                $notification->title,
                $notification->body,
                $notification->data ?? []
            );
        }
    }
}
