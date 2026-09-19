<?php

namespace App\Filament\Resources\Supabase\Coupons\Pages;

use App\Filament\Resources\Supabase\Coupons\CouponResource;
use Filament\Resources\Pages\CreateRecord;

class CreateCoupon extends CreateRecord
{
    protected static string $resource = CouponResource::class;
}
