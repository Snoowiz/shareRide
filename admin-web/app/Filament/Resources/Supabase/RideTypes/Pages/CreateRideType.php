<?php

namespace App\Filament\Resources\Supabase\RideTypes\Pages;

use App\Filament\Resources\Supabase\RideTypes\RideTypeResource;
use Filament\Resources\Pages\CreateRecord;
use Illuminate\Support\Str;

class CreateRideType extends CreateRecord
{
    protected static string $resource = RideTypeResource::class;

    protected function mutateFormDataBeforeCreate(array $data): array
    {
        if (empty($data['id'])) {
            $data['id'] = Str::uuid()->toString();
        }
        return $data;
    }
}
