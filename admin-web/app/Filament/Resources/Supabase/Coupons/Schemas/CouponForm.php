<?php

namespace App\Filament\Resources\Supabase\Coupons\Schemas;

use Filament\Forms;
use Filament\Schemas\Schema;
use Filament\Schemas\Components\Section;

class CouponForm
{
    public static function configure(Schema $schema): Schema
    {
        return $schema
            ->components([
                Section::make('Coupon Information')
                    ->description('Set code and headline information for this promotion.')
                    ->columns(2)
                    ->schema([
                        Forms\Components\TextInput::make('code')
                            ->label('Coupon Code')
                            ->required()
                            ->maxLength(50)
                            ->unique(ignoreRecord: true)
                            ->placeholder('e.g. GORIDE20')
                            ->extraInputAttributes(['style' => 'text-transform: uppercase; font-weight: 700;'])
                            ->dehydrateStateUsing(fn ($state) => strtoupper(trim((string) $state))),

                        Forms\Components\TextInput::make('title')
                            ->label('Banner Tag / Title')
                            ->placeholder('e.g. LIMITED OFFER, WEEKEND PROMO')
                            ->default('LIMITED OFFER'),

                        Forms\Components\TextInput::make('description')
                            ->label('Headline Description')
                            ->placeholder('e.g. 20% off your next 3 rides')
                            ->default('20% off your next rides')
                            ->columnSpanFull(),
                    ]),

                Section::make('Discount Rules')
                    ->description('Define discount calculation and requirements.')
                    ->columns(2)
                    ->schema([
                        Forms\Components\Select::make('discount_type')
                            ->label('Discount Type')
                            ->options([
                                'percentage' => 'Percentage (%)',
                                'fixed' => 'Fixed Amount (NGN)',
                            ])
                            ->default('percentage')
                            ->live()
                            ->required(),

                        Forms\Components\TextInput::make('discount_percentage')
                            ->label('Discount Percentage')
                            ->numeric()
                            ->minValue(1)
                            ->maxValue(100)
                            ->suffix('%')
                            ->visible(fn ($get) => $get('discount_type') !== 'fixed')
                            ->required(fn ($get) => $get('discount_type') !== 'fixed'),

                        Forms\Components\TextInput::make('discount_amount')
                            ->label('Fixed Discount (NGN)')
                            ->numeric()
                            ->prefix('NGN')
                            ->visible(fn ($get) => $get('discount_type') === 'fixed')
                            ->required(fn ($get) => $get('discount_type') === 'fixed'),

                        Forms\Components\TextInput::make('max_discount_amount')
                            ->label('Maximum Discount Cap (NGN)')
                            ->numeric()
                            ->prefix('NGN')
                            ->helperText('Maximum discount amount allowed for percentage discounts (optional).'),

                        Forms\Components\TextInput::make('min_ride_fare')
                            ->label('Minimum Ride Fare (NGN)')
                            ->numeric()
                            ->prefix('NGN')
                            ->default(0)
                            ->helperText('Minimum fare required to apply this coupon.'),
                    ]),

                Section::make('Limits & Validity')
                    ->description('Set usage quotas and validity dates.')
                    ->columns(2)
                    ->schema([
                        Forms\Components\TextInput::make('usage_limit')
                            ->label('Total Platform Usage Limit')
                            ->numeric()
                            ->default(500)
                            ->helperText('Total times coupon can be redeemed across all riders.'),

                        Forms\Components\TextInput::make('per_user_limit')
                            ->label('Per-Rider Limit')
                            ->numeric()
                            ->default(1)
                            ->helperText('Maximum times a single rider can redeem this code.'),

                        Forms\Components\DateTimePicker::make('valid_from')
                            ->label('Valid From')
                            ->default(now()),

                        Forms\Components\DateTimePicker::make('valid_until')
                            ->label('Valid Until (Expiry)')
                            ->helperText('Leave empty for no expiry date.'),

                        Forms\Components\Toggle::make('is_active')
                            ->label('Is Active')
                            ->default(true)
                            ->helperText('Enable or disable redemption immediately.'),

                        Forms\Components\Toggle::make('show_on_home')
                            ->label('Feature on Rider Home Banner')
                            ->default(true)
                            ->helperText('Display this promotion as the featured banner on the mobile app.'),
                    ]),

                Section::make('Banner & Appearance')
                    ->description('Customize the visual presentation of this coupon on the mobile app.')
                    ->columns(2)
                    ->schema([
                        Forms\Components\TextInput::make('banner_image_url')
                            ->label('Banner Graphic Image URL')
                            ->placeholder('https://... (optional image URL)')
                            ->helperText('Optional image to display as the background of the promo card.')
                            ->columnSpanFull(),

                        Forms\Components\ColorPicker::make('bg_color')
                            ->label('Background Accent Color')
                            ->default('#0F346E')
                            ->helperText('Default GoRide Navy is #0F346E. Use #FCCA14 for Yellow.'),

                        Forms\Components\ColorPicker::make('text_color')
                            ->label('Text Color')
                            ->default('#FFFFFF'),
                    ]),
            ]);
    }
}
