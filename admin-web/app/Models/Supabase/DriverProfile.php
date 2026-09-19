<?php

namespace App\Models\Supabase;

use Illuminate\Database\Eloquent\Model;

class DriverProfile extends Model
{
    protected $connection = 'supabase';
    protected $table = 'driver_profiles';
    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = [
        'id', 'driver_type', 'date_of_birth', 'gender',
        'drivers_license_url', 'profile_photo_url', 'nin_slip_url',
        'vehicle_year', 'vehicle_make', 'license_plate', 'vehicle_color',
        'vehicle_particulars_url', 'vehicle_exterior_url', 'billing_type',
        'residential_address', 'bank_name', 'account_number', 'account_name',
        'next_of_kin_name', 'next_of_kin_phone', 'next_of_kin_relationship',
        'verification_status', 'license_number',
    ];

    protected $casts = [
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public function profile()
    {
        return $this->belongsTo(Profile::class, 'id', 'id');
    }
}
