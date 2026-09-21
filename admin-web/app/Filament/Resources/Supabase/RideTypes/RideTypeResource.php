<?php

namespace App\Filament\Resources\Supabase\RideTypes;

use App\Filament\Resources\Supabase\RideTypes\Pages\CreateRideType;
use App\Filament\Resources\Supabase\RideTypes\Pages\EditRideType;
use App\Filament\Resources\Supabase\RideTypes\Pages\ListRideTypes;
use App\Filament\Resources\Supabase\RideTypes\Schemas\RideTypeForm;
use App\Filament\Resources\Supabase\RideTypes\Tables\RideTypesTable;
use App\Models\Supabase\RideType;
use BackedEnum;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Tables\Table;

class RideTypeResource extends Resource
{
    protected static ?string $model = RideType::class;

    protected static string|BackedEnum|null $navigationIcon = 'heroicon-o-truck';
    protected static string | \UnitEnum | null $navigationGroup = 'Fleet';
    protected static ?string $navigationLabel = 'Ride Types';
    protected static ?int $navigationSort = 1;
    protected static ?string $slug = 'ride-types';

    public static function canAccess(): bool
    {
        $user = auth()->user();
        if (!$user) return false;
        if ($user->hasRole('super_admin') || ($user->is_super_admin ?? false)) return true;
        return $user->can('manage_ride_types') || $user->can('view_rides');
    }

    protected static ?string $recordTitleAttribute = 'name';

    public static function form(Schema $schema): Schema
    {
        return RideTypeForm::configure($schema);
    }

    public static function table(Table $table): Table
    {
        return RideTypesTable::configure($table);
    }

    public static function getRelations(): array
    {
        return [];
    }

    public static function getPages(): array
    {
        return [
            'index' => ListRideTypes::route('/'),
            'create' => CreateRideType::route('/create'),
            'edit' => EditRideType::route('/{record}/edit'),
        ];
    }
}
