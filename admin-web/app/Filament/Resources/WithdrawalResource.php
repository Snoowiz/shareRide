<?php

namespace App\Filament\Resources;

use App\Filament\Resources\WithdrawalResource\Pages;
use App\Models\Supabase\WithdrawalRequest;
use Filament\Forms;
use Filament\Notifications\Notification;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Tables;
use Filament\Tables\Table;

class WithdrawalResource extends Resource
{
    protected static ?string $model = WithdrawalRequest::class;
    protected static string | \BackedEnum | null $navigationIcon = 'heroicon-o-banknotes';
    protected static string | \UnitEnum | null $navigationGroup = 'Finance';
    protected static ?string $navigationLabel = 'Withdrawals';
    protected static ?int $navigationSort = 1;

    public static function canAccess(): bool
    {
        return auth()->user()?->can('manage_withdrawals') ?? false;
    }

    public static function getEloquentQuery(): \Illuminate\Database\Eloquent\Builder
    {
        return parent::getEloquentQuery()->with(['driver']);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                Tables\Columns\TextColumn::make('driver.first_name')
                    ->label('Driver')
                    ->formatStateUsing(fn($record) => $record->driver?->full_name ?? 'N/A')
                    ->searchable(),

                Tables\Columns\TextColumn::make('amount')
                    ->money('NGN')
                    ->sortable(),

                Tables\Columns\TextColumn::make('bank_name')
                    ->label('Bank'),

                Tables\Columns\TextColumn::make('account_number')
                    ->label('Account #')
                    ->copyable(),

                Tables\Columns\TextColumn::make('account_name')
                    ->label('Account Name'),

                Tables\Columns\TextColumn::make('status')
                    ->badge()
                    ->color(fn(string $state) => match ($state) {
                        'completed' => 'success',
                        'approved' => 'info',
                        'pending' => 'warning',
                        'rejected' => 'danger',
                        default => 'gray',
                    }),

                Tables\Columns\TextColumn::make('requested_at')
                    ->label('Requested')
                    ->dateTime('M d, Y h:i A')
                    ->sortable(),

                Tables\Columns\TextColumn::make('processed_at')
                    ->label('Processed')
                    ->dateTime('M d, Y h:i A'),
            ])
            ->filters([
                Tables\Filters\SelectFilter::make('status')
                    ->options([
                        'pending' => 'Pending',
                        'approved' => 'Approved',
                        'completed' => 'Completed',
                        'rejected' => 'Rejected',
                    ]),
            ])
            ->actions([
                \Filament\Actions\Action::make('approve')
                    ->icon('heroicon-o-check-circle')
                    ->color('success')
                    ->requiresConfirmation()
                    ->visible(fn($record) => $record->status === 'pending')
                    ->action(function ($record) {
                        $record->update([
                            'status' => 'approved',
                            'processed_at' => now(),
                        ]);

                        \App\Models\Supabase\Notification::create([
                            'user_id' => $record->driver_id,
                            'type' => 'withdrawal_approved',
                            'title' => 'Withdrawal Approved',
                            'body' => 'Your withdrawal of ₦' . number_format($record->amount, 2) . ' has been approved.',
                            'data' => json_encode(['screen' => 'driver_wallet']),
                        ]);

                        Notification::make()->title('Withdrawal approved')->success()->send();
                    }),

                \Filament\Actions\Action::make('complete')
                    ->label('Mark Paid')
                    ->icon('heroicon-o-currency-dollar')
                    ->color('info')
                    ->requiresConfirmation()
                    ->visible(fn($record) => $record->status === 'approved')
                    ->action(function ($record) {
                        $record->update([
                            'status' => 'completed',
                            'processed_at' => now(),
                        ]);

                        \App\Models\Supabase\Notification::create([
                            'user_id' => $record->driver_id,
                            'type' => 'withdrawal_completed',
                            'title' => 'Payout Completed',
                            'body' => '₦' . number_format($record->amount, 2) . ' has been sent to your bank account.',
                            'data' => json_encode(['screen' => 'driver_wallet']),
                        ]);

                        Notification::make()->title('Payout marked as completed')->success()->send();
                    }),

                \Filament\Actions\Action::make('reject')
                    ->icon('heroicon-o-x-circle')
                    ->color('danger')
                    ->requiresConfirmation()
                    ->form([
                        Forms\Components\Textarea::make('admin_note')
                            ->label('Rejection Reason')
                            ->required(),
                    ])
                    ->visible(fn($record) => $record->status === 'pending')
                    ->action(function ($record, array $data) {
                        $record->update([
                            'status' => 'rejected',
                            'admin_note' => $data['admin_note'],
                            'processed_at' => now(),
                        ]);

                        \App\Models\Supabase\Notification::create([
                            'user_id' => $record->driver_id,
                            'type' => 'withdrawal_rejected',
                            'title' => 'Withdrawal Rejected',
                            'body' => 'Your withdrawal was rejected: ' . $data['admin_note'],
                            'data' => json_encode(['screen' => 'driver_wallet']),
                        ]);

                        Notification::make()->title('Withdrawal rejected')->warning()->send();
                    }),
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
            'index' => Pages\ListWithdrawals::route('/'),
        ];
    }

    public static function getNavigationBadge(): ?string
    {
        return (string) WithdrawalRequest::where('status', 'pending')->count();
    }

    public static function getNavigationBadgeColor(): ?string
    {
        return WithdrawalRequest::where('status', 'pending')->count() > 0 ? 'danger' : 'success';
    }
}
