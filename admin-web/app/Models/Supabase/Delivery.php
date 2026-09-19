<?php

namespace App\Models\Supabase;

use Illuminate\Database\Eloquent\Model;

class Delivery extends Model
{
    protected $connection = 'supabase';
    protected $table = 'deliveries';
    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = [
        'id', 'rider_id', 'driver_id', 'status', 'parcel_type', 'parcel_weight',
        'sender_name', 'sender_phone', 'sender_lat', 'sender_lng', 'sender_address',
        'receiver_name', 'receiver_phone', 'receiver_lat', 'receiver_lng', 'receiver_address',
        'distance_km', 'duration_mins', 'vehicle_type', 'fare', 'offer_fare',
        'payer_type', 'payment_method', 'parcel_image_url', 'terms_accepted',
        'commission_amount', 'driver_payout', 'payment_status',
    ];

    protected $casts = [
        'fare' => 'decimal:2',
        'offer_fare' => 'decimal:2',
        'distance_km' => 'float',
        'duration_mins' => 'float',
        'parcel_weight' => 'decimal:2',
        'commission_amount' => 'decimal:2',
        'driver_payout' => 'decimal:2',
        'terms_accepted' => 'boolean',
        'created_at' => 'datetime',
        'accepted_at' => 'datetime',
        'picked_up_at' => 'datetime',
        'delivered_at' => 'datetime',
    ];

    public function sender()
    {
        return $this->belongsTo(Profile::class, 'rider_id', 'id');
    }

    public function driver()
    {
        return $this->belongsTo(Profile::class, 'driver_id', 'id');
    }
}
