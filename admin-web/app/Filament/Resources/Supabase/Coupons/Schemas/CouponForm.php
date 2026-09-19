<?php

namespace App\Filament\Resources\Supabase\Coupons\Schemas;

use Filament\Schemas\Schema;

class CouponForm
{
    public static function configure(Schema $schema): Schema
    {
        return $schema
            ->components([
                \Filament\Forms\Components\TextInput::make('code')
                    ->required()
                    ->maxLength(50)
                    ->unique(ignoreRecord: true),
                \Filament\Forms\Components\TextInput::make('discount_percentage')
                    ->required()
                    ->numeric()
                    ->minValue(0)
                    ->maxValue(100),
                \Filament\Forms\Components\TextInput::make('max_discount_amount')
                    ->numeric(),
                \Filament\Forms\Components\TextInput::make('min_ride_fare')
                    ->numeric(),
                \Filament\Forms\Components\DateTimePicker::make('valid_from')
                    ->default(now()),
                \Filament\Forms\Components\DateTimePicker::make('valid_until'),
                \Filament\Forms\Components\TextInput::make('usage_limit')
                    ->numeric()
                    ->default(100),
                \Filament\Forms\Components\TextInput::make('times_used')
                    ->numeric()
                    ->default(0)
                    ->disabled(),
                \Filament\Forms\Components\Toggle::make('is_active')
                    ->default(true),
            ]);
    }
}
