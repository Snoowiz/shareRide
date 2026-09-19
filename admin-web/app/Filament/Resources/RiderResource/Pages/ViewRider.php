<?php

namespace App\Filament\Resources\RiderResource\Pages;

use App\Filament\Resources\RiderResource;
use Filament\Resources\Pages\ViewRecord;
use Filament\Infolists\Components\ImageEntry;
use Filament\Schemas\Components\Section;
use Filament\Infolists\Components\TextEntry;
use Filament\Schemas\Schema;

class ViewRider extends ViewRecord
{
    protected static string $resource = RiderResource::class;

    public function infolist(Schema $schema): Schema
    {
        return $schema->components([
            Section::make('Personal Information')
                ->columns(3)
                ->schema([
                    ImageEntry::make('avatar_url')->label('Photo')->circular()->size(80),
                    TextEntry::make('first_name')->label('First Name'),
                    TextEntry::make('last_name')->label('Last Name'),
                    TextEntry::make('email')->copyable(),
                    TextEntry::make('phone')->copyable(),
                    TextEntry::make('created_at')->label('Joined')->dateTime('M d, Y h:i A'),
                ]),
            Section::make('Account Status')
                ->columns(3)
                ->schema([
                    TextEntry::make('role')->badge()->color('info'),
                    TextEntry::make('is_suspended')
                        ->label('Suspended')
                        ->badge()
                        ->formatStateUsing(fn ($state) => $state ? 'Suspended' : 'Active')
                        ->color(fn ($state) => $state ? 'danger' : 'success')
                        ->default(false),
                    TextEntry::make('wallet.balance')
                        ->label('Wallet Balance')
                        ->money('NGN')
                        ->default('0.00'),
                ]),
            Section::make('Activity Summary')
                ->columns(4)
                ->schema([
                    TextEntry::make('rides_count')
                        ->label('Total Rides')
                        ->state(fn ($record) => $record->rides()->count()),
                    TextEntry::make('deliveries_count')
                        ->label('Deliveries Sent')
                        ->state(fn ($record) => $record->deliveriesSent()->count()),
                    TextEntry::make('tickets_count')
                        ->label('Support Tickets')
                        ->state(fn ($record) => $record->supportTickets()->count()),
                    TextEntry::make('total_spent')
                        ->label('Total Spent')
                        ->state(fn ($record) => '₦' . number_format(
                            $record->rides()->where('status', 'completed')->sum('fare') +
                            $record->deliveriesSent()->where('status', 'delivered')->sum('fare'),
                            2
                        )),
                ]),
        ]);
    }
}
