<?php

namespace App\Filament\Resources;

use App\Filament\Resources\DeliveryResource\Pages;
use App\Models\Supabase\Delivery;
use Filament\Forms;
use Filament\Notifications\Notification;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Tables;
use Filament\Tables\Table;
use Illuminate\Support\Str;

class DeliveryResource extends Resource
{
    protected static ?string $model = Delivery::class;
    protected static string | \BackedEnum | null $navigationIcon = 'heroicon-o-cube';
    protected static string | \UnitEnum | null $navigationGroup = 'Operations';
    protected static ?string $navigationLabel = 'Deliveries';
    protected static ?int $navigationSort = 2;

    public static function canAccess(): bool
    {
        return auth()->user()?->can('view_deliveries') ?? false;
    }

    public static function getEloquentQuery(): \Illuminate\Database\Eloquent\Builder
    {
        return parent::getEloquentQuery()->with(['sender', 'driver']);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                Tables\Columns\TextColumn::make('id')->label('ID')->limit(8)->copyable(),
                Tables\Columns\TextColumn::make('sender.first_name')
                    ->label('Sender')
                    ->formatStateUsing(fn($record) => $record->sender?->full_name ?? 'N/A'),
                Tables\Columns\TextColumn::make('driver.first_name')
                    ->label('Driver')
                    ->formatStateUsing(fn($record) => $record->driver?->full_name ?? 'Unassigned'),
                Tables\Columns\TextColumn::make('parcel_type')->label('Parcel')->badge(),
                Tables\Columns\TextColumn::make('status')
                    ->badge()
                    ->color(fn(string $state) => match ($state) {
                        'delivered' => 'success', 'cancelled' => 'danger', 'in_transit' => 'info',
                        'picked_up' => 'warning', 'accepted' => 'primary', default => 'gray',
                    }),
                Tables\Columns\TextColumn::make('fare')->money('NGN')->sortable(),
                Tables\Columns\TextColumn::make('vehicle_type')->badge()
                    ->color(fn(string $state) => $state === 'car' ? 'info' : 'warning'),
                Tables\Columns\TextColumn::make('payment_status')->badge()
                    ->color(fn(?string $state) => match ($state) {
                        'settled' => 'success', 'pending' => 'warning', default => 'danger',
                    }),
                Tables\Columns\TextColumn::make('created_at')->dateTime('M d, Y h:i A')->sortable(),
            ])
            ->filters([
                Tables\Filters\SelectFilter::make('status')
                    ->options([
                        'searching' => 'Searching', 'accepted' => 'Accepted',
                        'picked_up' => 'Picked Up', 'in_transit' => 'In Transit',
                        'delivered' => 'Delivered', 'cancelled' => 'Cancelled',
                    ]),
            ])
            ->actions([
                \Filament\Actions\ViewAction::make(),

                \Filament\Actions\Action::make('cancel')
                    ->label('Cancel')
                    ->icon('heroicon-o-x-circle')
                    ->color('danger')
                    ->requiresConfirmation()
                    ->form([
                        Forms\Components\Textarea::make('reason')
                            ->label('Cancellation Reason')
                            ->required(),
                    ])
                    ->visible(fn($record) => in_array($record->status, ['searching', 'accepted', 'picked_up', 'in_transit']))
                    ->action(function ($record, array $data) {
                        $record->update(['status' => 'cancelled']);

                        if ($record->rider_id) {
                            \App\Models\Supabase\Notification::create([
                                'id' => Str::uuid()->toString(),
                                'user_id' => $record->rider_id,
                                'type' => 'delivery_cancelled',
                                'title' => 'Delivery Cancelled',
                                'body' => 'Your delivery has been cancelled by admin. Reason: ' . $data['reason'],
                                'data' => json_encode(['screen' => 'home']),
                                'is_read' => false,
                            ]);
                        }

                        if ($record->driver_id) {
                            \App\Models\Supabase\Notification::create([
                                'id' => Str::uuid()->toString(),
                                'user_id' => $record->driver_id,
                                'type' => 'delivery_cancelled',
                                'title' => 'Delivery Cancelled',
                                'body' => 'A delivery has been cancelled by admin. Reason: ' . $data['reason'],
                                'data' => json_encode(['screen' => 'driver_home']),
                                'is_read' => false,
                            ]);
                        }

                        Notification::make()->title('Delivery cancelled')->warning()->send();
                    }),
            ])
            ->defaultSort('created_at', 'desc');
    }

    public static function form(Schema $schema): Schema
    {
        return $schema->components([
            \Filament\Forms\Components\Section::make('Delivery Details')
                ->schema([
                    \Filament\Forms\Components\TextInput::make('id')->label('Delivery ID'),
                    \Filament\Forms\Components\TextInput::make('sender.first_name')->label('Sender')->formatStateUsing(fn($record) => $record->sender?->full_name ?? 'N/A'),
                    \Filament\Forms\Components\TextInput::make('driver.first_name')->label('Driver')->formatStateUsing(fn($record) => $record->driver?->full_name ?? 'Unassigned'),
                    \Filament\Forms\Components\TextInput::make('parcel_type')->label('Parcel Type'),
                    \Filament\Forms\Components\TextInput::make('status')->label('Status'),
                    \Filament\Forms\Components\TextInput::make('distance_km')->label('Distance (km)')->numeric(),
                    \Filament\Forms\Components\TextInput::make('fare')->label('Fare')->numeric(),
                    \Filament\Forms\Components\TextInput::make('vehicle_type')->label('Vehicle Type'),
                    \Filament\Forms\Components\TextInput::make('payment_method')->label('Payment Method'),
                    \Filament\Forms\Components\TextInput::make('payment_status')->label('Payment Status'),
                ])->columns(2),
            \Filament\Forms\Components\Section::make('Locations & Contact')
                ->schema([
                    \Filament\Forms\Components\TextInput::make('pickup_location_name')->label('Pickup Location')->columnSpanFull(),
                    \Filament\Forms\Components\TextInput::make('dropoff_location_name')->label('Dropoff Location')->columnSpanFull(),
                    \Filament\Forms\Components\TextInput::make('recipient_name')->label('Recipient Name'),
                    \Filament\Forms\Components\TextInput::make('recipient_phone')->label('Recipient Phone'),
                ])->columns(2),
        ]);
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListDeliveries::route('/'),
            'view' => Pages\ViewDelivery::route('/{record}'),
        ];
    }

    public static function getNavigationBadge(): ?string
    {
        return (string) Delivery::whereIn('status', ['searching', 'accepted', 'picked_up', 'in_transit'])->count();
    }
}
