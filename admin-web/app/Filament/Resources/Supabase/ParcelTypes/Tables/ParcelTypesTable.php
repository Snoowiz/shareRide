<?php

namespace App\Filament\Resources\Supabase\ParcelTypes\Tables;

use Filament\Actions\BulkActionGroup;
use Filament\Actions\DeleteBulkAction;
use Filament\Actions\EditAction;
use Filament\Actions\DeleteAction;
use Filament\Notifications\Notification;
use Filament\Tables;
use Filament\Tables\Table;

class ParcelTypesTable
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
                    ->label('Parcel Category')
                    ->weight('bold')
                    ->searchable()
                    ->sortable()
                    ->description(fn ($record) => $record->description ?: "Code: {$record->code}"),

                Tables\Columns\TextColumn::make('code')
                    ->label('System Code')
                    ->badge()
                    ->color('gray')
                    ->copyable()
                    ->searchable(),

                Tables\Columns\TextColumn::make('icon_name')
                    ->label('Icon')
                    ->badge()
                    ->color('info')
                    ->icon('heroicon-o-sparkles'),

                Tables\Columns\IconColumn::make('has_svg')
                    ->label('Custom SVG')
                    ->state(fn ($record) => !empty($record->icon_svg))
                    ->boolean()
                    ->trueIcon('heroicon-o-check-circle')
                    ->falseIcon('heroicon-o-minus')
                    ->trueColor('success')
                    ->falseColor('gray'),

                Tables\Columns\TextColumn::make('deliveries_count')
                    ->label('Total Deliveries')
                    ->state(fn ($record) => $record->deliveries()->count())
                    ->badge()
                    ->color('primary')
                    ->suffix(' Deliveries'),

                Tables\Columns\ToggleColumn::make('is_active')
                    ->label('Active')
                    ->sortable(),
            ])
            ->defaultSort('display_order', 'asc')
            ->actions([
                EditAction::make(),
                DeleteAction::make()
                    ->before(function (DeleteAction $action, $record) {
                        $count = $record->deliveries()->count();
                        if ($count > 0) {
                            Notification::make()
                                ->danger()
                                ->title('Cannot Delete Parcel Type')
                                ->body("This parcel category is referenced by {$count} delivery records in the database. Deactivate it instead of deleting to preserve historical data.")
                                ->persistent()
                                ->send();

                            $action->halt();
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
