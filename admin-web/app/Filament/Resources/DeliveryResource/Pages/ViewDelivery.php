<?php

namespace App\Filament\Resources\DeliveryResource\Pages;

use App\Filament\Resources\DeliveryResource;
use Filament\Resources\Pages\ViewRecord;
use Filament\Schemas\Components\Section;
use Filament\Infolists\Components\TextEntry;
use Filament\Schemas\Schema;

class ViewDelivery extends ViewRecord
{
    protected static string $resource = DeliveryResource::class;

    public function infolist(Schema $schema): Schema
    {
        return $schema->components([
            Section::make('Delivery Details')
                ->columns(3)
                ->schema([
                    TextEntry::make('id')->label('Delivery ID')->copyable(),
                    TextEntry::make('status')->badge()->color(fn (string $state) => match ($state) {
                        'delivered' => 'success', 'cancelled' => 'danger', 'in_transit' => 'info',
                        'picked_up' => 'warning', 'accepted' => 'primary', default => 'gray',
                    }),
                    TextEntry::make('parcel_type')->label('Parcel Type')->badge(),
                    TextEntry::make('vehicle_type')->label('Vehicle')->badge(),
                    TextEntry::make('parcel_weight')->label('Weight')->suffix(' kg'),
                    TextEntry::make('created_at')->dateTime('M d, Y h:i A'),
                ]),
            Section::make('Participants')
                ->columns(2)
                ->schema([
                    TextEntry::make('sender.first_name')
                        ->label('Sender')
                        ->formatStateUsing(fn ($record) => $record->sender?->full_name ?? 'N/A'),
                    TextEntry::make('driver.first_name')
                        ->label('Driver')
                        ->formatStateUsing(fn ($record) => $record->driver?->full_name ?? 'Unassigned'),
                ]),
            Section::make('Pickup & Dropoff')
                ->columns(2)
                ->schema([
                    TextEntry::make('sender_address')->label('Pickup Address')->columnSpanFull(),
                    TextEntry::make('sender_name')->label('Sender Name'),
                    TextEntry::make('sender_phone')->label('Sender Phone')->copyable(),
                    TextEntry::make('receiver_address')->label('Dropoff Address')->columnSpanFull(),
                    TextEntry::make('receiver_name')->label('Recipient Name'),
                    TextEntry::make('receiver_phone')->label('Recipient Phone')->copyable(),
                ]),
            Section::make('Route & Timing')
                ->columns(4)
                ->schema([
                    TextEntry::make('distance_km')->label('Distance')->suffix(' km'),
                    TextEntry::make('duration_mins')->label('Duration')->suffix(' mins'),
                    TextEntry::make('accepted_at')->label('Accepted')->dateTime('M d h:i A'),
                    TextEntry::make('picked_up_at')->label('Picked Up')->dateTime('M d h:i A'),
                    TextEntry::make('delivered_at')->label('Delivered')->dateTime('M d h:i A'),
                ]),
            Section::make('Financials')
                ->columns(4)
                ->schema([
                    TextEntry::make('fare')->money('NGN'),
                    TextEntry::make('offer_fare')->label('Bid Price')->money('NGN'),
                    TextEntry::make('commission_amount')->label('Commission')->money('NGN'),
                    TextEntry::make('driver_payout')->label('Driver Payout')->money('NGN'),
                    TextEntry::make('payer_type')->label('Payer')->badge(),
                    TextEntry::make('payment_method')->badge(),
                    TextEntry::make('payment_status')->badge()->color(fn (?string $state) => match ($state) {
                        'settled' => 'success', 'pending' => 'warning', default => 'danger',
                    }),
                ]),
        ]);
    }
}
