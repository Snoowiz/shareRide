<?php

namespace App\Filament\Resources\RiderResource\RelationManagers;

use Filament\Resources\RelationManagers\RelationManager;
use Filament\Tables;
use Filament\Tables\Table;

class SupportTicketsRelationManager extends RelationManager
{
    protected static string $relationship = 'supportTickets';
    protected static ?string $title = 'Support Tickets';

    public function table(Table $table): Table
    {
        return $table
            ->columns([
                Tables\Columns\TextColumn::make('id')->label('ID')->limit(8)->copyable(),
                Tables\Columns\TextColumn::make('subject')->limit(40),
                Tables\Columns\TextColumn::make('status')
                    ->badge()
                    ->color(fn (?string $state) => match ($state) {
                        'open' => 'warning', 'closed' => 'success', default => 'gray',
                    }),
                Tables\Columns\TextColumn::make('created_at')->dateTime('M d, Y')->sortable(),
            ])
            ->defaultSort('created_at', 'desc');
    }
}
