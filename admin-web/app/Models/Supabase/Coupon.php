<?php

namespace App\Models\Supabase;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Coupon extends Model
{
    use HasFactory;

    protected $connection = 'supabase';
    protected $table = 'coupons';

    protected $fillable = [
        'code',
        'discount_percentage',
        'max_discount_amount',
        'min_ride_fare',
        'valid_from',
        'valid_until',
        'usage_limit',
        'times_used',
        'is_active',
    ];

    protected $casts = [
        'valid_from' => 'datetime',
        'valid_until' => 'datetime',
        'is_active' => 'boolean',
    ];
}
