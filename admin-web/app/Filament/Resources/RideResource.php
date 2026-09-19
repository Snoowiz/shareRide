<?php

namespace App\Filament\Resources;

use App\Filament\Resources\RideResource\Pages;
use App\Models\Supabase\Ride;
use Filament\Forms;
use Filament\Notifications\Notification;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Tables;
use Filament\Tables\Table;
use Illuminate\Support\Str;

class RideResource extends Resource
{
    protected static ?string $model = Ride::class;
    protected static string | \BackedEnum | null $navigationIcon = 'heroicon-o-map-pin';
    protected static string | \UnitEnum | null $navigationGroup = 'Operations';
    protected static ?string $navigationLabel = 'Rides';
    protected static ?int $navigationSort = 1;

    public static function canAccess(): bool
    {
        return auth()->user()?->can('view_rides') ?? false;
    }

    public static function getEloquentQuery(): \Illuminate\Database\Eloquent\Builder
    {
        return parent::getEloquentQuery()->with(['rider', 'driver']);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                Tables\Columns\TextColumn::make('id')->label('ID')->limit(8)->copyable(),

                Tables\Columns\TextColumn::make('rider.first_name')
                    ->label('Rider')
                    ->formatStateUsing(fn($record) => $record->rider?->full_name ?? 'N/A')
                    ->searchable(),

                Tables\Columns\TextColumn::make('driver.first_name')
                    ->label('Driver')
                    ->formatStateUsing(fn($record) => $record->driver?->full_name ?? 'Unassigned')
                    ->searchable(),

                Tables\Columns\TextColumn::make('ride_type')
                    ->label('Type')
                    ->badge(),

                Tables\Columns\TextColumn::make('status')
                    ->badge()
                    ->color(fn(string $state) => match ($state) {
                        'completed' => 'success',
                        'cancelled' => 'danger',
                        'ongoing' => 'info',
                        'accepted' => 'warning',
                        'searching' => 'gray',
                        'scheduled' => 'primary',
                        default => 'gray',
                    }),

                Tables\Columns\TextColumn::make('fare')
                    ->money('NGN')
                    ->sortable(),

                Tables\Columns\TextColumn::make('commission_amount')
                    ->label('Commission')
                    ->money('NGN'),

                Tables\Columns\TextColumn::make('payment_method')
                    ->label('Payment')
                    ->badge()
                    ->color(fn(?string $state) => match ($state) {
                        'wallet' => 'success',
                        'paystack' => 'info',
                        default => 'gray',
                    }),

                Tables\Columns\TextColumn::make('payment_status')
                    ->label('Payment Status')
                    ->badge()
                    ->color(fn(?string $state) => match ($state) {
                        'settled' => 'success',
                        'pending' => 'warning',
                        'failed' => 'danger',
                        default => 'gray',
                    }),

                Tables\Columns\TextColumn::make('distance_km')
                    ->label('Distance')
                    ->suffix(' km')
                    ->numeric(2),

                Tables\Columns\TextColumn::make('created_at')
                    ->label('Created')
                    ->dateTime('M d, Y h:i A')
                    ->sortable(),
            ])
            ->filters([
                Tables\Filters\SelectFilter::make('status')
                    ->options([
                        'searching' => 'Searching',
                        'accepted' => 'Accepted',
                        'ongoing' => 'Ongoing',
                        'completed' => 'Completed',
                        'cancelled' => 'Cancelled',
                        'scheduled' => 'Scheduled',
                    ]),
                Tables\Filters\SelectFilter::make('payment_status')
                    ->options([
                        'pending' => 'Pending',
                        'settled' => 'Settled',
                        'failed' => 'Failed',
                    ]),
            ])
            ->actions([
                \Filament\Actions\ViewAction::make(),

                \Filament\Actions\Action::make('cancel')
                    ->label('Cancel Ride')
                    ->icon('heroicon-o-x-circle')
                    ->color('danger')
                    ->requiresConfirmation()
                    ->modalHeading('Cancel This Ride')
                    ->form([
                        Forms\Components\Textarea::make('reason')
                            ->label('Cancellation Reason')
                            ->required(),
                    ])
                    ->visible(fn($record) => in_array($record->status, ['searching', 'accepted', 'ongoing']))
                    ->action(function ($record, array $data) {
                        $record->update(['status' => 'cancelled']);

                        // Notify rider
                        if ($record->rider_id) {
                            \App\Models\Supabase\Notification::create([
                                'id' => Str::uuid()->toString(),
                                'user_id' => $record->rider_id,
                                'type' => 'ride_cancelled',
                                'title' => 'Ride Cancelled',
                                'body' => 'Your ride has been cancelled by admin. Reason: ' . $data['reason'],
                                'data' => json_encode(['screen' => 'home']),
                                'is_read' => false,
                            ]);
                        }

                        // Notify driver
                        if ($record->driver_id) {
                            \App\Models\Supabase\Notification::create([
                                'id' => Str::uuid()->toString(),
                                'user_id' => $record->driver_id,
                                'type' => 'ride_cancelled',
                                'title' => 'Ride Cancelled',
                                'body' => 'A ride has been cancelled by admin. Reason: ' . $data['reason'],
                                'data' => json_encode(['screen' => 'driver_home']),
                                'is_read' => false,
                            ]);
                        }

                        Notification::make()->title('Ride cancelled')->warning()->send();
                    }),
            ])
            ->defaultSort('created_at', 'desc');
    }

    public static function form(Schema $schema): Schema
    {
        return $schema->components([
            \Filament\Forms\Components\Section::make('Ride Details')
                ->schema([
                    \Filament\Forms\Components\TextInput::make('id')->label('Ride ID'),
                    \Filament\Forms\Components\TextInput::make('rider.first_name')->label('Rider')->formatStateUsing(fn($record) => $record->rider?->full_name ?? 'N/A'),
                    \Filament\Forms\Components\TextInput::make('driver.first_name')->label('Driver')->formatStateUsing(fn($record) => $record->driver?->full_name ?? 'Unassigned'),
                    \Filament\Forms\Components\TextInput::make('ride_type')->label('Type'),
                    \Filament\Forms\Components\TextInput::make('status')->label('Status'),
                    \Filament\Forms\Components\TextInput::make('distance_km')->label('Distance (km)')->numeric(),
                    \Filament\Forms\Components\TextInput::make('fare')->label('Fare')->numeric(),
                    \Filament\Forms\Components\TextInput::make('commission_amount')->label('Commission')->numeric(),
                    \Filament\Forms\Components\TextInput::make('payment_method')->label('Payment Method'),
                    \Filament\Forms\Components\TextInput::make('payment_status')->label('Payment Status'),
                ])->columns(2),
            \Filament\Forms\Components\Section::make('Locations')
                ->schema([
                    \Filament\Forms\Components\TextInput::make('pickup_location_name')->label('Pickup Location')->columnSpanFull(),
                    \Filament\Forms\Components\TextInput::make('dropoff_location_name')->label('Dropoff Location')->columnSpanFull(),
                ])->columns(1),
        ]);
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListRides::route('/'),
            'view' => Pages\ViewRide::route('/{record}'),
        ];
    }

    public static function getNavigationBadge(): ?string
    {
        return (string) Ride::whereIn('status', ['searching', 'accepted', 'ongoing'])->count();
    }

    public static function getNavigationBadgeColor(): ?string
    {
        return Ride::whereIn('status', ['ongoing'])->count() > 0 ? 'success' : 'gray';
    }
}
