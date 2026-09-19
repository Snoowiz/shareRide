<?php

namespace App\Models\Supabase;

use Illuminate\Database\Eloquent\Model;

class Profile extends Model
{
    protected $connection = 'supabase';
    protected $table = 'profiles';
    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = [
        'id', 'first_name', 'last_name', 'phone', 'avatar_url', 'role',
        'is_driver_verified', 'email', 'expo_push_token', 'active_session_id',
    ];

    protected $casts = [
        'is_driver_verified' => 'boolean',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public function getFullNameAttribute(): string
    {
        return trim("{$this->first_name} {$this->last_name}");
    }

    public function driverProfile()
    {
        return $this->hasOne(DriverProfile::class, 'id', 'id');
    }

    public function userProfile()
    {
        return $this->hasOne(UserProfile::class, 'id', 'id');
    }

    public function wallet()
    {
        return $this->hasOne(Wallet::class, 'id', 'id');
    }

    public function rides()
    {
        return $this->hasMany(Ride::class, 'rider_id', 'id');
    }

    public function driverRides()
    {
        return $this->hasMany(Ride::class, 'driver_id', 'id');
    }

    public function deliveriesSent()
    {
        return $this->hasMany(Delivery::class, 'rider_id', 'id');
    }

    public function deliveriesDriven()
    {
        return $this->hasMany(Delivery::class, 'driver_id', 'id');
    }

    public function notifications()
    {
        return $this->hasMany(Notification::class, 'user_id', 'id');
    }

    public function supportTickets()
    {
        return $this->hasMany(SupportTicket::class, 'user_id', 'id');
    }

    public function withdrawalRequests()
    {
        return $this->hasMany(WithdrawalRequest::class, 'driver_id', 'id');
    }

    public function pushTokens()
    {
        return $this->hasMany(PushToken::class, 'user_id', 'id');
    }

    public function availableDriver()
    {
        return $this->hasOne(AvailableDriver::class, 'id', 'id');
    }
}
