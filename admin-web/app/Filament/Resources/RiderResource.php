<?php

namespace App\Filament\Resources;

use App\Filament\Resources\RiderResource\Pages;
use App\Filament\Resources\RiderResource\RelationManagers;
use App\Models\Supabase\Profile;
use App\Models\Supabase\Wallet;
use App\Models\Supabase\WalletTransaction;
use Filament\Forms;
use Filament\Notifications\Notification;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Schemas\Components;
use Filament\Tables;
use Filament\Tables\Table;
use Illuminate\Support\Str;

class RiderResource extends Resource
{
    protected static ?string $model = Profile::class;
    protected static string | \BackedEnum | null $navigationIcon = 'heroicon-o-user';
    protected static string | \UnitEnum | null $navigationGroup = 'Users & Drivers';
    protected static ?string $navigationLabel = 'Riders';
    protected static ?int $navigationSort = 1;
    protected static ?string $slug = 'riders';

    public static function canAccess(): bool
    {
        return auth()->user()?->can('view_riders') ?? false;
    }

    public static function getEloquentQuery(): \Illuminate\Database\Eloquent\Builder
    {
        return parent::getEloquentQuery()->where('role', 'user');
    }

    public static function form(Schema $schema): Schema
    {
        return $schema->components([
            Components\Section::make('Personal Information')
                ->columns(2)
                ->schema([
                    Components\TextInput::make('first_name')->required(),
                    Components\TextInput::make('last_name')->required(),
                    Components\TextInput::make('email')->email(),
                    Components\TextInput::make('phone'),
                ]),
        ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                Tables\Columns\ImageColumn::make('avatar_url')
                    ->label('Avatar')
                    ->circular()
                    ->defaultImageUrl(fn($record) => 'https://ui-avatars.com/api/?name=' . urlencode($record->full_name) . '&background=0F346E&color=fff'),

                Tables\Columns\TextColumn::make('first_name')
                    ->label('Name')
                    ->formatStateUsing(fn($record) => $record->full_name)
                    ->searchable(['first_name', 'last_name'])
                    ->sortable(),

                Tables\Columns\TextColumn::make('email')
                    ->searchable()
                    ->copyable(),

                Tables\Columns\TextColumn::make('phone')
                    ->searchable()
                    ->copyable(),

                Tables\Columns\IconColumn::make('is_suspended')
                    ->label('Suspended')
                    ->boolean()
                    ->trueIcon('heroicon-o-x-circle')
                    ->falseIcon('heroicon-o-check-circle')
                    ->trueColor('danger')
                    ->falseColor('success'),

                Tables\Columns\TextColumn::make('created_at')
                    ->label('Joined')
                    ->dateTime('M d, Y')
                    ->sortable(),
            ])
            ->filters([
                Tables\Filters\TernaryFilter::make('is_suspended')
                    ->label('Account Status')
                    ->trueLabel('Suspended')
                    ->falseLabel('Active'),
            ])
            ->actions([
                \Filament\Actions\ViewAction::make(),
                \Filament\Actions\EditAction::make(),

                // Suspend action
                \Filament\Actions\Action::make('suspend')
                    ->label('Suspend')
                    ->icon('heroicon-o-no-symbol')
                    ->color('danger')
                    ->requiresConfirmation()
                    ->modalHeading('Suspend Rider')
                    ->modalDescription('This rider will no longer be able to use the app.')
                    ->visible(fn($record) => !$record->is_suspended)
                    ->action(function ($record) {
                        $record->update(['is_suspended' => true]);

                        \App\Models\Supabase\Notification::create([
                            'id' => Str::uuid()->toString(),
                            'user_id' => $record->id,
                            'type' => 'system',
                            'title' => 'Account Suspended',
                            'body' => 'Your account has been suspended. Contact support for more information.',
                            'data' => json_encode(['screen' => 'support']),
                            'is_read' => false,
                        ]);

                        Notification::make()->title('Rider suspended')->warning()->send();
                    }),

                // Unsuspend action
                \Filament\Actions\Action::make('unsuspend')
                    ->label('Unsuspend')
                    ->icon('heroicon-o-check-circle')
                    ->color('success')
                    ->requiresConfirmation()
                    ->visible(fn($record) => $record->is_suspended)
                    ->action(function ($record) {
                        $record->update(['is_suspended' => false]);
                        Notification::make()->title('Rider account restored')->success()->send();
                    }),

                // Credit wallet
                \Filament\Actions\Action::make('credit_wallet')
                    ->label('Credit Wallet')
                    ->icon('heroicon-o-plus-circle')
                    ->color('success')
                    ->form([
                        Forms\Components\TextInput::make('amount')
                            ->label('Amount (NGN)')
                            ->numeric()
                            ->required()
                            ->minValue(1),
                        Forms\Components\Textarea::make('reason')
                            ->label('Reason')
                            ->required(),
                    ])
                    ->action(function ($record, array $data) {
                        $wallet = Wallet::find($record->id);
                        if (!$wallet) {
                            Notification::make()->title('No wallet found for this rider')->danger()->send();
                            return;
                        }

                        $wallet->increment('balance', $data['amount']);

                        WalletTransaction::create([
                            'id' => Str::uuid()->toString(),
                            'wallet_id' => $wallet->id,
                            'type' => 'credit',
                            'category' => 'admin_adjustment',
                            'amount' => $data['amount'],
                            'description' => 'Admin credit: ' . $data['reason'],
                            'status' => 'completed',
                        ]);

                        Notification::make()->title('₦' . number_format($data['amount'], 2) . ' credited')->success()->send();
                    }),

                // Debit wallet
                \Filament\Actions\Action::make('debit_wallet')
                    ->label('Debit Wallet')
                    ->icon('heroicon-o-minus-circle')
                    ->color('warning')
                    ->form([
                        Forms\Components\TextInput::make('amount')
                            ->label('Amount (NGN)')
                            ->numeric()
                            ->required()
                            ->minValue(1),
                        Forms\Components\Textarea::make('reason')
                            ->label('Reason')
                            ->required(),
                    ])
                    ->requiresConfirmation()
                    ->action(function ($record, array $data) {
                        $wallet = Wallet::find($record->id);
                        if (!$wallet) {
                            Notification::make()->title('No wallet found for this rider')->danger()->send();
                            return;
                        }

                        $wallet->decrement('balance', $data['amount']);

                        WalletTransaction::create([
                            'id' => Str::uuid()->toString(),
                            'wallet_id' => $wallet->id,
                            'type' => 'debit',
                            'category' => 'admin_adjustment',
                            'amount' => $data['amount'],
                            'description' => 'Admin debit: ' . $data['reason'],
                            'status' => 'completed',
                        ]);

                        Notification::make()->title('₦' . number_format($data['amount'], 2) . ' debited')->warning()->send();
                    }),
            ])
            ->bulkActions([])
            ->defaultSort('created_at', 'desc');
    }

    public static function getRelations(): array
    {
        return [
            RelationManagers\RidesRelationManager::class,
            RelationManagers\DeliveriesRelationManager::class,
            RelationManagers\SupportTicketsRelationManager::class,
        ];
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListRiders::route('/'),
            'edit' => Pages\EditRider::route('/{record}/edit'),
            'view' => Pages\ViewRider::route('/{record}'),
        ];
    }

    public static function getNavigationBadge(): ?string
    {
        try {
            $count = \Illuminate\Support\Facades\Cache::remember('nav_badge_rider', 30, function () {
                return static::getEloquentQuery()->count();
            });
            return (string) $count;
        } catch (\Throwable $e) {
            return null;
        }
    }
}
