<?php

namespace App\Filament\Resources\Supabase\RideTypes\Pages;

use App\Filament\Resources\Supabase\RideTypes\RideTypeResource;
use Filament\Actions\DeleteAction;
use Filament\Resources\Pages\EditRecord;

class EditRideType extends EditRecord
{
    protected static string $resource = RideTypeResource::class;

    protected function getHeaderActions(): array
    {
        return [
            DeleteAction::make(),
        ];
    }
}
