<?php

namespace App\Filament\Resources\Supabase\ParcelTypes;

use App\Filament\Resources\Supabase\ParcelTypes\Pages\CreateParcelType;
use App\Filament\Resources\Supabase\ParcelTypes\Pages\EditParcelType;
use App\Filament\Resources\Supabase\ParcelTypes\Pages\ListParcelTypes;
use App\Filament\Resources\Supabase\ParcelTypes\Schemas\ParcelTypeForm;
use App\Filament\Resources\Supabase\ParcelTypes\Tables\ParcelTypesTable;
use App\Models\Supabase\ParcelType;
use BackedEnum;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Tables\Table;

class ParcelTypeResource extends Resource
{
    protected static ?string $model = ParcelType::class;

    protected static string|BackedEnum|null $navigationIcon = 'heroicon-o-cube';
    protected static string | \UnitEnum | null $navigationGroup = 'Operations';
    protected static ?string $navigationLabel = 'Parcel Types';
    protected static ?int $navigationSort = 3;
    protected static ?string $slug = 'parcel-types';

    public static function canAccess(): bool
    {
        $user = auth()->user();
        if (!$user) return false;
        if ($user->hasRole('super_admin') || ($user->is_super_admin ?? false)) return true;
        return $user->can('manage_parcel_types') || $user->can('view_deliveries');
    }

    protected static ?string $recordTitleAttribute = 'name';

    public static function form(Schema $schema): Schema
    {
        return ParcelTypeForm::configure($schema);
    }

    public static function table(Table $table): Table
    {
        return ParcelTypesTable::configure($table);
    }

    public static function getRelations(): array
    {
        return [];
    }

    public static function getPages(): array
    {
        return [
            'index' => ListParcelTypes::route('/'),
            'create' => CreateParcelType::route('/create'),
            'edit' => EditParcelType::route('/{record}/edit'),
        ];
    }
}
