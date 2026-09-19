<?php

namespace App\Models\Supabase;

use Illuminate\Database\Eloquent\Model;

class Ride extends Model
{
    protected $connection = 'supabase';
    protected $table = 'rides';
    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = [
        'id', 'rider_id', 'driver_id', 'pickup_lat', 'pickup_lng', 'pickup_address',
        'destination_lat', 'destination_lng', 'destination_address', 'ride_type',
        'fare', 'distance_km', 'duration_mins', 'status', 'commission_amount',
        'driver_payout', 'surge_multiplier', 'scheduled_at', 'is_scheduled',
        'payment_method', 'payment_status',
    ];

    protected $casts = [
        'fare' => 'decimal:2',
        'distance_km' => 'float',
        'duration_mins' => 'float',
        'commission_amount' => 'decimal:2',
        'driver_payout' => 'decimal:2',
        'surge_multiplier' => 'decimal:2',
        'is_scheduled' => 'boolean',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'scheduled_at' => 'datetime',
    ];

    public function rider()
    {
        return $this->belongsTo(Profile::class, 'rider_id', 'id');
    }

    public function driver()
    {
        return $this->belongsTo(Profile::class, 'driver_id', 'id');
    }

    public function ratings()
    {
        return $this->hasMany(Rating::class, 'ride_id', 'id');
    }

    public function messages()
    {
        return $this->hasMany(Message::class, 'ride_id', 'id');
    }
}
