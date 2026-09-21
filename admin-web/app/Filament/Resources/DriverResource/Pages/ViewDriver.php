<?php

namespace App\Filament\Resources\DriverResource\Pages;

use App\Filament\Resources\DriverResource;
use Filament\Resources\Pages\ViewRecord;
use Filament\Infolists\Components\ImageEntry;
use Filament\Schemas\Components\Section;
use Filament\Infolists\Components\TextEntry;
use Filament\Schemas\Schema;

class ViewDriver extends ViewRecord
{
    protected static string $resource = DriverResource::class;

    public function infolist(Schema $schema): Schema
    {
        return $schema
            ->components([
                Section::make('Personal Information')
                    ->columns(3)
                    ->schema([
                        ImageEntry::make('avatar_url')->label('Photo')->circular()->size(80),
                        TextEntry::make('first_name')->label('First Name'),
                        TextEntry::make('last_name')->label('Last Name'),
                        TextEntry::make('email'),
                        TextEntry::make('phone'),
                        TextEntry::make('created_at')->label('Joined')->dateTime('M d, Y h:i A'),
                    ]),
                Section::make('Driver Details')
                    ->columns(3)
                    ->schema([
                        TextEntry::make('driverProfile.rideType.name')
                            ->label('Assigned Ride Type')
                            ->badge()
                            ->color('primary')
                            ->default(fn ($record) => ucfirst($record->driverProfile?->driver_type ?? 'Unassigned')),
                        TextEntry::make('driverProfile.driver_type')->label('Category')->badge(),
                        TextEntry::make('driverProfile.vehicle_make')->label('Vehicle Make'),
                        TextEntry::make('driverProfile.vehicle_year')->label('Year'),
                        TextEntry::make('driverProfile.vehicle_color')->label('Color'),
                        TextEntry::make('driverProfile.license_plate')->label('License Plate'),
                        TextEntry::make('driverProfile.license_number')->label('License #'),
                        TextEntry::make('driverProfile.verification_status')
                            ->label('Verification')
                            ->badge()
                            ->color(fn(?string $state) => match ($state) {
                                'approved' => 'success',
                                'pending' => 'warning',
                                'rejected' => 'danger',
                                default => 'gray',
                            }),
                    ]),
                Section::make('Documents')
                    ->columns(3)
                    ->schema([
                        ImageEntry::make('driverProfile.drivers_license_url')->label('Drivers License')->size(200),
                        ImageEntry::make('driverProfile.nin_slip_url')->label('NIN Slip')->size(200),
                        ImageEntry::make('driverProfile.vehicle_particulars_url')->label('Vehicle Papers')->size(200),
                        ImageEntry::make('driverProfile.vehicle_exterior_url')->label('Vehicle Photo')->size(200),
                        ImageEntry::make('driverProfile.profile_photo_url')->label('Profile Photo')->size(200),
                    ]),
                Section::make('Banking')
                    ->columns(3)
                    ->schema([
                        TextEntry::make('driverProfile.bank_name')->label('Bank'),
                        TextEntry::make('driverProfile.account_number')->label('Account #'),
                        TextEntry::make('driverProfile.account_name')->label('Account Name'),
                    ]),
                Section::make('Emergency Contact')
                    ->columns(3)
                    ->schema([
                        TextEntry::make('driverProfile.next_of_kin_name')->label('Name'),
                        TextEntry::make('driverProfile.next_of_kin_phone')->label('Phone'),
                        TextEntry::make('driverProfile.next_of_kin_relationship')->label('Relationship'),
                    ]),
            ]);
    }
}
