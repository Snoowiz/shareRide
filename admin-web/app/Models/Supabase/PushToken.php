<?php

namespace App\Models\Supabase;

use Illuminate\Database\Eloquent\Model;

class PushToken extends Model
{
    protected $connection = 'supabase';
    protected $table = 'push_tokens';
    protected $keyType = 'string';
    public $incrementing = false;
    public $timestamps = false;

    protected $fillable = ['id', 'user_id', 'token', 'device_name', 'platform', 'is_active'];

    protected $casts = [
        'is_active' => 'boolean',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public function user()
    {
        return $this->belongsTo(Profile::class, 'user_id', 'id');
    }
}
