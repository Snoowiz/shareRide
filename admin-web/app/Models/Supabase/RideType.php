<?php

namespace App\Models\Supabase;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class RideType extends Model
{
    use HasFactory;

    protected $connection = 'supabase';
    protected $table = 'ride_types';
    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = [
        'id',
        'code',
        'name',
        'description',
        'icon_name',
        'image_url',
        'passenger_capacity',
        'base_fare',
        'price_per_km',
        'price_per_min',
        'minimum_fare',
        'estimated_pickup_mins',
        'supports_shared_rides',
        'shared_discount_percentage',
        'display_order',
        'is_active',
    ];

    protected $casts = [
        'passenger_capacity' => 'integer',
        'base_fare' => 'float',
        'price_per_km' => 'float',
        'price_per_min' => 'float',
        'minimum_fare' => 'float',
        'estimated_pickup_mins' => 'integer',
        'supports_shared_rides' => 'boolean',
        'shared_discount_percentage' => 'float',
        'display_order' => 'integer',
        'is_active' => 'boolean',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public function driverProfiles()
    {
        return $this->hasMany(DriverProfile::class, 'ride_type_id', 'id');
    }

    public function rides()
    {
        return $this->hasMany(Ride::class, 'ride_type_id', 'id');
    }

    /**
     * Get the count of online, verified, and unassigned drivers for this ride type.
     */
    public function getOnlineDriversCountAttribute(): int
    {
        return DriverProfile::where('ride_type_id', $this->id)
            ->where('verification_status', 'approved')
            ->whereHas('profile', function ($q) {
                $q->where('is_driver_verified', true)
                  ->where('is_suspended', false);
            })
            ->whereHas('profile.availableDriver', function ($q) {
                $q->where('is_online', true);
            })
            ->whereDoesntHave('profile.driverRides', function ($q) {
                $q->whereIn('status', ['accepted', 'ongoing'])
                  ->where('is_shared', false);
            })
            ->count();
    }
}
