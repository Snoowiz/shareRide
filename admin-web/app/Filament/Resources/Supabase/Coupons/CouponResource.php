<?php

namespace App\Filament\Resources\Supabase\Coupons;

use App\Filament\Resources\Supabase\Coupons\Pages\CreateCoupon;
use App\Filament\Resources\Supabase\Coupons\Pages\EditCoupon;
use App\Filament\Resources\Supabase\Coupons\Pages\ListCoupons;
use App\Filament\Resources\Supabase\Coupons\Schemas\CouponForm;
use App\Filament\Resources\Supabase\Coupons\Tables\CouponsTable;
use App\Models\Supabase\Coupon;
use BackedEnum;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Table;

class CouponResource extends Resource
{
    protected static ?string $model = Coupon::class;

    protected static string|BackedEnum|null $navigationIcon = 'heroicon-o-ticket';
    protected static string | \UnitEnum | null $navigationGroup = 'Finance';
    protected static ?string $navigationLabel = 'Coupons';
    protected static ?int $navigationSort = 3;
    protected static ?string $slug = 'coupons';

    public static function canAccess(): bool
    {
        $user = auth()->user();
        if (!$user) return false;
        if ($user->hasRole('super_admin') || ($user->is_super_admin ?? false)) return true;
        return $user->can('manage_coupons');
    }

    protected static ?string $recordTitleAttribute = 'code';

    public static function form(Schema $schema): Schema
    {
        return CouponForm::configure($schema);
    }

    public static function table(Table $table): Table
    {
        return CouponsTable::configure($table);
    }

    public static function getRelations(): array
    {
        return [
            //
        ];
    }

    public static function getPages(): array
    {
        return [
            'index' => ListCoupons::route('/'),
            'create' => CreateCoupon::route('/create'),
            'edit' => EditCoupon::route('/{record}/edit'),
        ];
    }
}
