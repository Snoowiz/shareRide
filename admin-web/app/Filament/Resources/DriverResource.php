<?php

namespace App\Filament\Resources;

use App\Filament\Resources\DriverResource\Pages;
use App\Filament\Resources\DriverResource\RelationManagers;
use App\Models\Supabase\Profile;
use Filament\Forms;
use Filament\Notifications\Notification;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Schemas\Components;
use Filament\Tables;
use Filament\Tables\Table;
use Illuminate\Support\Str;

class DriverResource extends Resource
{
    protected static ?string $model = Profile::class;
    protected static string | \BackedEnum | null $navigationIcon = 'heroicon-o-truck';
    protected static string | \UnitEnum | null $navigationGroup = 'Users & Drivers';
    protected static ?string $navigationLabel = 'Drivers';
    protected static ?int $navigationSort = 2;
    protected static ?string $slug = 'drivers';

    public static function canAccess(): bool
    {
        return auth()->user()?->can('view_drivers') ?? false;
    }

    public static function getEloquentQuery(): \Illuminate\Database\Eloquent\Builder
    {
        return parent::getEloquentQuery()->where('role', 'driver')->with(['driverProfile']);
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
                    ->defaultImageUrl(fn($record) => 'https://ui-avatars.com/api/?name=' . urlencode($record->full_name) . '&background=FCCA14&color=000'),

                Tables\Columns\TextColumn::make('first_name')
                    ->label('Name')
                    ->formatStateUsing(fn($record) => $record->full_name)
                    ->searchable(['first_name', 'last_name'])
                    ->sortable(),

                Tables\Columns\TextColumn::make('email')
                    ->searchable()
                    ->copyable(),

                Tables\Columns\TextColumn::make('phone')
                    ->searchable(),

                Tables\Columns\TextColumn::make('driverProfile.driver_type')
                    ->label('Vehicle')
                    ->badge()
                    ->color(fn(string $state): string => match ($state) {
                        'car' => 'info',
                        'motorbike' => 'warning',
                        'tricycle' => 'success',
                        default => 'gray',
                    }),

                Tables\Columns\TextColumn::make('driverProfile.verification_status')
                    ->label('Verification')
                    ->badge()
                    ->color(fn(?string $state): string => match ($state) {
                        'approved' => 'success',
                        'pending' => 'warning',
                        'rejected' => 'danger',
                        default => 'gray',
                    }),

                Tables\Columns\IconColumn::make('is_driver_verified')
                    ->label('Verified')
                    ->boolean(),

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
                Tables\Filters\SelectFilter::make('verification_status')
                    ->label('Verification Status')
                    ->options([
                        'pending' => 'Pending',
                        'approved' => 'Approved',
                        'rejected' => 'Rejected',
                    ])
                    ->query(function ($query, $data) {
                        if ($data['value']) {
                            $query->whereHas('driverProfile', fn($q) => $q->where('verification_status', $data['value']));
                        }
                    }),
                Tables\Filters\TernaryFilter::make('is_suspended')
                    ->label('Account Status')
                    ->trueLabel('Suspended')
                    ->falseLabel('Active'),
            ])
            ->actions([
                \Filament\Actions\ViewAction::make(),

                // Approve driver
                \Filament\Actions\Action::make('approve')
                    ->label('Approve')
                    ->icon('heroicon-o-check-circle')
                    ->color('success')
                    ->requiresConfirmation()
                    ->visible(fn($record) => $record->driverProfile?->verification_status === 'pending')
                    ->action(function ($record) {
                        $record->driverProfile->update(['verification_status' => 'approved']);
                        $record->update(['is_driver_verified' => true]);

                        \App\Models\Supabase\Notification::create([
                            'id' => Str::uuid()->toString(),
                            'user_id' => $record->id,
                            'type' => 'profile_approved',
                            'title' => 'Verification Approved',
                            'body' => 'Congratulations! Your driver profile has been verified. You can now start accepting rides.',
                            'data' => json_encode(['screen' => 'driver_home']),
                            'is_read' => false,
                        ]);

                        Notification::make()->title('Driver approved successfully')->success()->send();
                    }),

                // Reject driver
                \Filament\Actions\Action::make('reject')
                    ->label('Reject')
                    ->icon('heroicon-o-x-circle')
                    ->color('danger')
                    ->requiresConfirmation()
                    ->form([
                        Forms\Components\Textarea::make('reason')
                            ->label('Rejection Reason')
                            ->required(),
                    ])
                    ->visible(fn($record) => $record->driverProfile?->verification_status === 'pending')
                    ->action(function ($record, array $data) {
                        $record->driverProfile->update(['verification_status' => 'rejected']);

                        \App\Models\Supabase\Notification::create([
                            'id' => Str::uuid()->toString(),
                            'user_id' => $record->id,
                            'type' => 'profile_rejected',
                            'title' => 'Verification Rejected',
                            'body' => 'Your driver profile verification was rejected. Reason: ' . $data['reason'],
                            'data' => json_encode(['screen' => 'driver_profile']),
                            'is_read' => false,
                        ]);

                        Notification::make()->title('Driver rejected')->warning()->send();
                    }),

                // Suspend
                \Filament\Actions\Action::make('suspend')
                    ->label('Suspend')
                    ->icon('heroicon-o-no-symbol')
                    ->color('danger')
                    ->requiresConfirmation()
                    ->modalHeading('Suspend Driver')
                    ->modalDescription('This driver will no longer be able to accept rides.')
                    ->visible(fn($record) => !$record->is_suspended)
                    ->action(function ($record) {
                        $record->update(['is_suspended' => true]);

                        \App\Models\Supabase\Notification::create([
                            'id' => Str::uuid()->toString(),
                            'user_id' => $record->id,
                            'type' => 'system',
                            'title' => 'Account Suspended',
                            'body' => 'Your driver account has been suspended. Contact support for more information.',
                            'data' => json_encode(['screen' => 'support']),
                            'is_read' => false,
                        ]);

                        Notification::make()->title('Driver suspended')->warning()->send();
                    }),

                // Unsuspend
                \Filament\Actions\Action::make('unsuspend')
                    ->label('Unsuspend')
                    ->icon('heroicon-o-check-circle')
                    ->color('success')
                    ->requiresConfirmation()
                    ->visible(fn($record) => $record->is_suspended)
                    ->action(function ($record) {
                        $record->update(['is_suspended' => false]);
                        Notification::make()->title('Driver account restored')->success()->send();
                    }),
            ])
            ->bulkActions([])
            ->defaultSort('created_at', 'desc');
    }

    public static function getRelations(): array
    {
        return [
            RelationManagers\DriverRidesRelationManager::class,
            RelationManagers\WithdrawalsRelationManager::class,
        ];
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListDrivers::route('/'),
            'view' => Pages\ViewDriver::route('/{record}'),
        ];
    }

    public static function getNavigationBadge(): ?string
    {
        return (string) static::getEloquentQuery()
            ->whereHas('driverProfile', fn($q) => $q->where('verification_status', 'pending'))
            ->count();
    }

    public static function getNavigationBadgeColor(): ?string
    {
        $count = static::getEloquentQuery()
            ->whereHas('driverProfile', fn($q) => $q->where('verification_status', 'pending'))
            ->count();

        return $count > 0 ? 'warning' : 'success';
    }
}
