<?php

namespace App\Filament\Resources\Supabase\RideTypes\Tables;

use Filament\Actions\BulkActionGroup;
use Filament\Actions\DeleteBulkAction;
use Filament\Actions\EditAction;
use Filament\Actions\DeleteAction;
use Filament\Tables;
use Filament\Tables\Table;

class RideTypesTable
{
    public static function configure(Table $table): Table
    {
        return $table
            ->columns([
                Tables\Columns\TextColumn::make('display_order')
                    ->label('#')
                    ->sortable()
                    ->width('50px'),

                Tables\Columns\TextColumn::make('name')
                    ->label('Ride Type')
                    ->weight('bold')
                    ->searchable()
                    ->sortable()
                    ->description(fn ($record) => $record->description ?: "Icon: {$record->icon_name}"),

                Tables\Columns\TextColumn::make('code')
                    ->label('Code')
                    ->badge()
                    ->color('gray')
                    ->copyable()
                    ->searchable(),

                Tables\Columns\TextColumn::make('passenger_capacity')
                    ->label('Capacity')
                    ->state(fn ($record) => "{$record->passenger_capacity} Seats")
                    ->sortable(),

                Tables\Columns\TextColumn::make('pricing')
                    ->label('Pricing (Base / KM / Min)')
                    ->state(fn ($record) => "₦" . number_format($record->base_fare, 0) . " + ₦" . number_format($record->price_per_km, 0) . "/km + ₦" . number_format($record->price_per_min, 0) . "/min"),

                Tables\Columns\IconColumn::make('supports_shared_rides')
                    ->label('Shared Ride')
                    ->boolean()
                    ->trueIcon('heroicon-o-check-circle')
                    ->falseIcon('heroicon-o-minus')
                    ->trueColor('success')
                    ->falseColor('gray'),

                Tables\Columns\TextColumn::make('online_drivers')
                    ->label('Online Drivers')
                    ->state(fn ($record) => $record->online_drivers_count)
                    ->badge()
                    ->color(fn ($state) => $state > 0 ? 'success' : 'danger')
                    ->suffix(' Drivers'),

                Tables\Columns\IconColumn::make('is_active')
                    ->label('Active')
                    ->boolean()
                    ->trueIcon('heroicon-o-check-circle')
                    ->falseIcon('heroicon-o-x-circle')
                    ->trueColor('success')
                    ->falseColor('danger'),
            ])
            ->defaultSort('display_order', 'asc')
            ->filters([
                Tables\Filters\TernaryFilter::make('is_active')
                    ->label('Active Status')
                    ->trueLabel('Active Only')
                    ->falseLabel('Inactive Only'),

                Tables\Filters\TernaryFilter::make('supports_shared_rides')
                    ->label('Shared Rides')
                    ->trueLabel('Supports Shared')
                    ->falseLabel('Standard Only'),
            ])
            ->actions([
                EditAction::make(),
                DeleteAction::make()
                    ->requiresConfirmation()
                    ->before(function ($record, $action) {
                        // Check if active rides exist using this ride type
                        $activeRides = \App\Models\Supabase\Ride::where('ride_type_id', $record->id)
                            ->whereIn('status', ['searching', 'accepted', 'ongoing'])
                            ->count();
                        if ($activeRides > 0) {
                            \Filament\Notifications\Notification::make()
                                ->title('Cannot Delete Ride Type')
                                ->body("There are currently {$activeRides} active rides using this ride type. Deactivate it instead.")
                                ->danger()
                                ->send();
                            $action->cancel();
                        }
                    }),
            ])
            ->bulkActions([
                BulkActionGroup::make([
                    DeleteBulkAction::make(),
                ]),
            ]);
    }
}
