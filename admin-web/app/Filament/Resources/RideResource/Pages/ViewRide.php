<?php

namespace App\Filament\Resources\RideResource\Pages;

use App\Filament\Resources\RideResource;
use Filament\Resources\Pages\ViewRecord;
use Filament\Schemas\Components\Section;
use Filament\Infolists\Components\TextEntry;
use Filament\Schemas\Schema;

class ViewRide extends ViewRecord
{
    protected static string $resource = RideResource::class;

    public function infolist(Schema $schema): Schema
    {
        return $schema->components([
            Section::make('Ride Details')
                ->columns(3)
                ->schema([
                    TextEntry::make('id')->label('Ride ID')->copyable(),
                    TextEntry::make('status')->badge()->color(fn(string $state) => match ($state) {
                        'completed' => 'success', 'cancelled' => 'danger', 'ongoing' => 'info', default => 'gray',
                    }),
                    TextEntry::make('ride_type')->label('Type'),
                    TextEntry::make('created_at')->dateTime('M d, Y h:i A'),
                ]),
            Section::make('Participants')
                ->columns(2)
                ->schema([
                    TextEntry::make('rider.first_name')->label('Rider')->formatStateUsing(fn($record) => $record->rider?->full_name),
                    TextEntry::make('driver.first_name')->label('Driver')->formatStateUsing(fn($record) => $record->driver?->full_name ?? 'Unassigned'),
                ]),
            Section::make('Route')
                ->columns(2)
                ->schema([
                    TextEntry::make('pickup_address')->label('Pickup'),
                    TextEntry::make('destination_address')->label('Destination'),
                    TextEntry::make('distance_km')->label('Distance')->suffix(' km'),
                    TextEntry::make('duration_mins')->label('Duration')->suffix(' mins'),
                ]),
            Section::make('Financials')
                ->columns(4)
                ->schema([
                    TextEntry::make('fare')->money('NGN'),
                    TextEntry::make('commission_amount')->label('Commission')->money('NGN'),
                    TextEntry::make('driver_payout')->label('Driver Payout')->money('NGN'),
                    TextEntry::make('surge_multiplier')->label('Surge'),
                    TextEntry::make('payment_method')->badge(),
                    TextEntry::make('payment_status')->badge()->color(fn(?string $state) => match ($state) {
                        'settled' => 'success', 'pending' => 'warning', default => 'danger',
                    }),
                ]),
        ]);
    }
}
