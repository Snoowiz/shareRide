<?php

namespace App\Filament\Resources\DriverResource\RelationManagers;

use Filament\Resources\RelationManagers\RelationManager;
use Filament\Tables;
use Filament\Tables\Table;

class WithdrawalsRelationManager extends RelationManager
{
    protected static string $relationship = 'withdrawalRequests';
    protected static ?string $title = 'Withdrawal History';

    public function table(Table $table): Table
    {
        return $table
            ->columns([
                Tables\Columns\TextColumn::make('amount')->money('NGN')->sortable(),
                Tables\Columns\TextColumn::make('bank_name')->label('Bank'),
                Tables\Columns\TextColumn::make('account_number')->label('Account #'),
                Tables\Columns\TextColumn::make('status')
                    ->badge()
                    ->color(fn (string $state) => match ($state) {
                        'completed' => 'success', 'approved' => 'info',
                        'pending' => 'warning', 'rejected' => 'danger',
                        default => 'gray',
                    }),
                Tables\Columns\TextColumn::make('requested_at')->dateTime('M d, Y')->sortable(),
            ])
            ->defaultSort('requested_at', 'desc');
    }
}
