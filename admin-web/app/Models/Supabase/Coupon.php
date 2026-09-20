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
        'title',
        'description',
        'discount_type',
        'discount_percentage',
        'discount_amount',
        'max_discount_amount',
        'min_ride_fare',
        'valid_from',
        'valid_until',
        'usage_limit',
        'per_user_limit',
        'times_used',
        'is_active',
        'banner_image_url',
        'bg_color',
        'text_color',
        'show_on_home',
    ];

    protected $casts = [
        'valid_from' => 'datetime',
        'valid_until' => 'datetime',
        'is_active' => 'boolean',
        'show_on_home' => 'boolean',
        'discount_percentage' => 'float',
        'discount_amount' => 'float',
        'max_discount_amount' => 'float',
        'min_ride_fare' => 'float',
        'usage_limit' => 'integer',
        'per_user_limit' => 'integer',
        'times_used' => 'integer',
    ];

    public function isValid(): bool
    {
        if (!$this->is_active) {
            return false;
        }

        $now = now();
        if ($this->valid_from && $now->lt($this->valid_from)) {
            return false;
        }

        if ($this->valid_until && $now->gt($this->valid_until)) {
            return false;
        }

        if ($this->usage_limit && $this->times_used >= $this->usage_limit) {
            return false;
        }

        return true;
    }

    public function calculateDiscount(float $fare): float
    {
        if ($this->min_ride_fare && $fare < $this->min_ride_fare) {
            return 0;
        }

        if ($this->discount_type === 'fixed') {
            $discount = (float) ($this->discount_amount ?? 0);
        } else {
            $percent = (float) ($this->discount_percentage ?? 0);
            $discount = ($fare * $percent) / 100;
            if ($this->max_discount_amount && $discount > $this->max_discount_amount) {
                $discount = (float) $this->max_discount_amount;
            }
        }

        return min($discount, $fare);
    }
}
