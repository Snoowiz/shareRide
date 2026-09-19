<?php

namespace App\Filament\Resources\RiderResource\RelationManagers;

use Filament\Resources\RelationManagers\RelationManager;
use Filament\Tables;
use Filament\Tables\Table;

class RidesRelationManager extends RelationManager
{
    protected static string $relationship = 'rides';
    protected static ?string $title = 'Ride History';

    public function table(Table $table): Table
    {
        return $table
            ->columns([
                Tables\Columns\TextColumn::make('id')->label('ID')->limit(8)->copyable(),
                Tables\Columns\TextColumn::make('driver.first_name')
                    ->label('Driver')
                    ->formatStateUsing(fn ($record) => $record->driver?->full_name ?? 'N/A'),
                Tables\Columns\TextColumn::make('status')
                    ->badge()
                    ->color(fn (string $state) => match ($state) {
                        'completed' => 'success', 'cancelled' => 'danger',
                        'ongoing' => 'info', default => 'gray',
                    }),
                Tables\Columns\TextColumn::make('fare')->money('NGN'),
                Tables\Columns\TextColumn::make('payment_method')->badge(),
                Tables\Columns\TextColumn::make('created_at')->dateTime('M d, Y')->sortable(),
            ])
            ->defaultSort('created_at', 'desc');
    }
}
