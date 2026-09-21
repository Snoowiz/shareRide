<?php

namespace App\Filament\Resources\Supabase\ParcelTypes\Pages;

use App\Filament\Resources\Supabase\ParcelTypes\ParcelTypeResource;
use Filament\Resources\Pages\CreateRecord;
use Illuminate\Support\Str;

class CreateParcelType extends CreateRecord
{
    protected static string $resource = ParcelTypeResource::class;

    protected function mutateFormDataBeforeCreate(array $data): array
    {
        if (empty($data['id'])) {
            $data['id'] = Str::uuid()->toString();
        }
        return $data;
    }
}
