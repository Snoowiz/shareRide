<?php

namespace App\Filament\Resources\Supabase\ParcelTypes\Pages;

use App\Filament\Resources\Supabase\ParcelTypes\ParcelTypeResource;
use Filament\Actions\CreateAction;
use Filament\Resources\Pages\ListRecords;

class ListParcelTypes extends ListRecords
{
    protected static string $resource = ParcelTypeResource::class;

    protected function getHeaderActions(): array
    {
        return [
            CreateAction::make(),
        ];
    }
}
