<?php

namespace App\Filament\Resources;

use App\Filament\Resources\WalletTransactionResource\Pages;
use App\Models\Supabase\WalletTransaction;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Tables;
use Filament\Tables\Table;

class WalletTransactionResource extends Resource
{
    protected static ?string $model = WalletTransaction::class;
    protected static string | \BackedEnum | null $navigationIcon = 'heroicon-o-document-text';
    protected static string | \UnitEnum | null $navigationGroup = 'Finance';
    protected static ?string $navigationLabel = 'Transactions';
    protected static ?int $navigationSort = 2;

    public static function canAccess(): bool
    {
        return auth()->user()?->can('view_transactions') ?? false;
    }

    public static function getEloquentQuery(): \Illuminate\Database\Eloquent\Builder
    {
        return parent::getEloquentQuery()->with(['wallet.profile']);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                Tables\Columns\TextColumn::make('id')->label('ID')->limit(8)->copyable(),

                Tables\Columns\TextColumn::make('wallet.profile.first_name')
                    ->label('User')
                    ->formatStateUsing(fn($record) => $record->wallet?->profile?->full_name ?? 'N/A'),

                Tables\Columns\TextColumn::make('type')
                    ->badge()
                    ->color(fn(string $state) => match ($state) {
                        'credit' => 'success',
                        'debit' => 'danger',
                        'refund' => 'info',
                        'withdrawal' => 'warning',
                        default => 'gray',
                    }),

                Tables\Columns\TextColumn::make('category')
                    ->badge(),

                Tables\Columns\TextColumn::make('amount')
                    ->money('NGN')
                    ->sortable(),

                Tables\Columns\TextColumn::make('description')
                    ->limit(40)
                    ->wrap(),

                Tables\Columns\TextColumn::make('status')
                    ->badge()
                    ->color(fn(?string $state) => match ($state) {
                        'completed' => 'success',
                        'pending' => 'warning',
                        'failed' => 'danger',
                        default => 'gray',
                    }),

                Tables\Columns\TextColumn::make('created_at')
                    ->dateTime('M d, Y h:i A')
                    ->sortable(),
            ])
            ->filters([
                Tables\Filters\SelectFilter::make('type')
                    ->options([
                        'credit' => 'Credit',
                        'debit' => 'Debit',
                        'refund' => 'Refund',
                        'withdrawal' => 'Withdrawal',
                    ]),
                Tables\Filters\SelectFilter::make('category')
                    ->options([
                        'ride_payment' => 'Ride Payment',
                        'delivery_payment' => 'Delivery Payment',
                        'commission' => 'Commission',
                        'wallet_topup' => 'Wallet Topup',
                        'withdrawal' => 'Withdrawal',
                        'cash_settlement' => 'Cash Settlement',
                    ]),
            ])
            ->defaultSort('created_at', 'desc');
    }

    public static function form(Schema $schema): Schema
    {
        return $schema->components([]);
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListWalletTransactions::route('/'),
        ];
    }
}
