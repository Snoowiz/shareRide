<?php

namespace App\Models\Supabase;

use Illuminate\Database\Eloquent\Model;

class UserProfile extends Model
{
    protected $connection = 'supabase';
    protected $table = 'user_profiles';
    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = [
        'id', 'date_of_birth', 'gender', 'verification_status',
        'id_type', 'id_front_url', 'id_back_url', 'selfie_url', 'verified_at',
    ];

    protected $casts = [
        'date_of_birth' => 'date',
        'verified_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public function profile()
    {
        return $this->belongsTo(Profile::class, 'id', 'id');
    }
}
