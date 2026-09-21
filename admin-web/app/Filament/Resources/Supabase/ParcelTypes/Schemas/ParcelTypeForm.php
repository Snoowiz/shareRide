<?php

namespace App\Filament\Resources\Supabase\ParcelTypes\Schemas;

use Filament\Forms;
use Filament\Schemas\Schema;
use Filament\Schemas\Components\Section;

class ParcelTypeForm
{
    public static function configure(Schema $schema): Schema
    {
        return $schema
            ->components([
                Section::make('General Information')
                    ->description('Define the parcel category name, unique identifier, description, and display order.')
                    ->columns(2)
                    ->schema([
                        Forms\Components\TextInput::make('name')
                            ->label('Category Name')
                            ->required()
                            ->maxLength(50)
                            ->placeholder('e.g. Fragile, Documents, Gift, Food, Clothing')
                            ->live(onBlur: true)
                            ->afterStateUpdated(function ($get, $set, ?string $state, ?string $operation) {
                                if ($operation === 'create' && empty($get('code')) && !empty($state)) {
                                    $set('code', strtolower(preg_replace('/[^a-z0-9]+/i', '_', trim($state))));
                                }
                            }),

                        Forms\Components\TextInput::make('code')
                            ->label('System Code')
                            ->required()
                            ->maxLength(30)
                            ->unique(ignoreRecord: true)
                            ->placeholder('e.g. fragile, documents, gift, food')
                            ->extraInputAttributes(['style' => 'text-transform: lowercase; font-weight: 700;'])
                            ->dehydrateStateUsing(fn ($state) => strtolower(trim((string) $state))),

                        Forms\Components\TextInput::make('description')
                            ->label('Description / Subtitle')
                            ->maxLength(100)
                            ->placeholder('e.g. Glass, ceramics, electronics')
                            ->columnSpan(2)
                            ->helperText('Shown directly under the parcel category name on the rider app.'),

                        Forms\Components\TextInput::make('display_order')
                            ->label('Display Order')
                            ->numeric()
                            ->default(1)
                            ->minValue(1)
                            ->helperText('Controls ordering in the mobile app grid (lower number appears first).'),

                        Forms\Components\Toggle::make('is_active')
                            ->label('Active Status')
                            ->default(true)
                            ->helperText('When enabled, this category is selectable by riders on the package delivery screen.'),
                    ]),

                Section::make('Icon & Visuals')
                    ->description('Choose a standard mobile app icon or provide a custom SVG icon.')
                    ->columns(1)
                    ->schema([
                        Forms\Components\Select::make('icon_name')
                            ->label('Standard Icon (Mobile App)')
                            ->options([
                                'wine-outline' => '🍷 Wine / Glass / Fragile (wine-outline)',
                                'document-text-outline' => '📄 Documents / Papers (document-text-outline)',
                                'gift-outline' => '🎁 Gift / Wrapped Present (gift-outline)',
                                'fast-food-outline' => '🍔 Food / Perishables / Meals (fast-food-outline)',
                                'shirt-outline' => '👕 Clothing / Apparel / Fabrics (shirt-outline)',
                                'cube-outline' => '📦 Package / Box / General Items (cube-outline)',
                                'medkit-outline' => '💊 Medical / Pharmacy / Health (medkit-outline)',
                                'hardware-chip-outline' => '💻 Electronics / Gadgets (hardware-chip-outline)',
                                'flower-outline' => '💐 Flowers / Plants (flower-outline)',
                                'book-outline' => '📚 Books / Stationery (book-outline)',
                                'briefcase-outline' => '💼 Luggage / Briefcase (briefcase-outline)',
                                'basket-outline' => '🧺 Groceries / Basket (basket-outline)',
                                'bag-handle-outline' => '🛍️ Shopping Bag (bag-handle-outline)',
                                'key-outline' => '🔑 Keys / Access Cards (key-outline)',
                                'sparkles-outline' => '✨ Jewelry / Valuables (sparkles-outline)',
                                'construct-outline' => '🛠️ Tools / Hardware (construct-outline)',
                                'heart-outline' => '❤️ Care Packages / Donations (heart-outline)',
                            ])
                            ->default('cube-outline')
                            ->required()
                            ->searchable()
                            ->helperText('Standard vector icon rendered across iOS and Android.'),

                        Forms\Components\Textarea::make('icon_svg')
                            ->label('Custom SVG Icon (Optional)')
                            ->rows(4)
                            ->placeholder('<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor">...</svg>')
                            ->helperText('Paste custom raw SVG markup if you wish to override the standard vector icon with your own custom graphic.'),
                    ]),
            ]);
    }
}
