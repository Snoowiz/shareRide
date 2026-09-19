<?php

namespace App\Models\Supabase;

use Illuminate\Database\Eloquent\Model;

class AvailableDriver extends Model
{
    protected $connection = 'supabase';
    protected $table = 'available_drivers';
    protected $keyType = 'string';
    public $incrementing = false;
    public $timestamps = false;

    protected $fillable = ['id', 'is_online', 'latitude', 'longitude', 'last_updated', 'heading'];

    protected $casts = [
        'is_online' => 'boolean',
        'latitude' => 'float',
        'longitude' => 'float',
        'heading' => 'float',
        'last_updated' => 'datetime',
    ];

    public function profile()
    {
        return $this->belongsTo(Profile::class, 'id', 'id');
    }
}
