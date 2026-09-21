<?php

namespace App\Filament\Resources\Supabase\RideTypes\Pages;

use App\Filament\Resources\Supabase\RideTypes\RideTypeResource;
use Filament\Actions\CreateAction;
use Filament\Resources\Pages\ListRecords;

class ListRideTypes extends ListRecords
{
    protected static string $resource = RideTypeResource::class;

    protected function getHeaderActions(): array
    {
        return [
            CreateAction::make(),
        ];
    }
}
