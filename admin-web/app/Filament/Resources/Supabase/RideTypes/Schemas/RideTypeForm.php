<?php

namespace App\Filament\Resources\Supabase\RideTypes\Schemas;

use Filament\Forms;
use Filament\Schemas\Schema;
use Filament\Schemas\Components\Section;

class RideTypeForm
{
    public static function configure(Schema $schema): Schema
    {
        return $schema
            ->components([
                Section::make('General Information')
                    ->description('Basic ride-type identity, display label, and vehicle icon.')
                    ->columns(2)
                    ->schema([
                        Forms\Components\TextInput::make('name')
                            ->label('Ride Type Name')
                            ->required()
                            ->maxLength(50)
                            ->placeholder('e.g. Mini, Sedan, Premium, GoXL')
                            ->live(onBlur: true)
                            ->afterStateUpdated(function ($get, $set, ?string $state, ?string $operation) {
                                if ($operation === 'create' && empty($get('code')) && !empty($state)) {
                                    $set('code', strtolower(preg_replace('/[^a-z0-9]+/i', '', $state)));
                                }
                            }),

                        Forms\Components\TextInput::make('code')
                            ->label('System Code')
                            ->required()
                            ->maxLength(30)
                            ->unique(ignoreRecord: true)
                            ->placeholder('e.g. mini, sedan, premium, xl')
                            ->extraInputAttributes(['style' => 'text-transform: lowercase; font-weight: 700;'])
                            ->dehydrateStateUsing(fn ($state) => strtolower(trim((string) $state))),

                        Forms\Components\Select::make('icon_name')
                            ->label('Vehicle Icon')
                            ->options([
                                'car-sport' => 'Sport / Sedan Car (car-sport)',
                                'car' => 'Standard Car (car)',
                                'bus' => 'Large / XL Van / Bus (bus)',
                                'car-outline' => 'Minimalist Car (car-outline)',
                                'shield-checkmark' => 'Executive / Premium (shield-checkmark)',
                                'flash' => 'Fast / Express (flash)',
                                'bicycle' => 'Motorcycle / Bike (bicycle)',
                            ])
                            ->default('car')
                            ->required(),

                        Forms\Components\TextInput::make('passenger_capacity')
                            ->label('Passenger Capacity (Seats)')
                            ->numeric()
                            ->minValue(1)
                            ->maxValue(20)
                            ->default(4)
                            ->required()
                            ->suffix('Seats'),

                        Forms\Components\TextInput::make('display_order')
                            ->label('Display Order')
                            ->numeric()
                            ->default(1)
                            ->helperText('Lower number appears first on the rider booking screen.'),

                        Forms\Components\TextInput::make('estimated_pickup_mins')
                            ->label('Base ETA Offset (Mins)')
                            ->numeric()
                            ->default(5)
                            ->suffix('Mins')
                            ->helperText('Estimated wait time added to duration for pickup arrival.'),

                        Forms\Components\Textarea::make('description')
                            ->label('Description / Subtitle')
                            ->placeholder('Brief description shown to riders (e.g. Spacious sedans with extra legroom)')
                            ->rows(2)
                            ->columnSpanFull(),
                    ]),

                Section::make('Pricing Configuration')
                    ->description('Authoritative pricing rules used by the backend to calculate fares.')
                    ->columns(2)
                    ->schema([
                        Forms\Components\TextInput::make('base_fare')
                            ->label('Base Fare')
                            ->numeric()
                            ->prefix('NGN')
                            ->default(500)
                            ->required()
                            ->helperText('Starting price charged before distance and time.'),

                        Forms\Components\TextInput::make('minimum_fare')
                            ->label('Minimum Trip Fare')
                            ->numeric()
                            ->prefix('NGN')
                            ->default(500)
                            ->required()
                            ->helperText('Lowest possible fare charge for any ride of this type.'),

                        Forms\Components\TextInput::make('price_per_km')
                            ->label('Price Per Kilometer')
                            ->numeric()
                            ->prefix('NGN')
                            ->default(150)
                            ->required(),

                        Forms\Components\TextInput::make('price_per_min')
                            ->label('Price Per Minute')
                            ->numeric()
                            ->prefix('NGN')
                            ->default(30)
                            ->required(),
                    ]),

                Section::make('Shared Rides & Availability Controls')
                    ->description('Configure shared-ride capability and system availability status.')
                    ->columns(2)
                    ->schema([
                        Forms\Components\Toggle::make('supports_shared_rides')
                            ->label('Supports Shared Rides')
                            ->helperText('Allow multiple riders to book individual seats in the same vehicle.')
                            ->default(false)
                            ->live(),

                        Forms\Components\TextInput::make('shared_discount_percentage')
                            ->label('Shared Ride Discount (%)')
                            ->numeric()
                            ->suffix('%')
                            ->minValue(0)
                            ->maxValue(90)
                            ->default(20)
                            ->visible(fn ($get) => (bool) $get('supports_shared_rides'))
                            ->helperText('Discount applied to the fare when a rider books as a shared ride.'),

                        Forms\Components\Toggle::make('is_active')
                            ->label('Active Status')
                            ->helperText('When inactive, this ride type cannot be booked by riders or selected by registering drivers.')
                            ->default(true),
                    ]),
            ]);
    }
}
