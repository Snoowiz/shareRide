<?php

namespace App\Filament\Resources\Supabase\Notifications\Pages;

use App\Filament\Resources\Supabase\Notifications\NotificationResource;
use Filament\Actions\DeleteAction;
use Filament\Resources\Pages\EditRecord;

class EditNotification extends EditRecord
{
    protected static string $resource = NotificationResource::class;

    protected function getHeaderActions(): array
    {
        return [
            DeleteAction::make(),
        ];
    }
}
