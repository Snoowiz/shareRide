<?php

namespace App\Models\Supabase;

use Illuminate\Database\Eloquent\Model;

class Notification extends Model
{
    protected $connection = 'supabase';
    protected $table = 'notifications';
    protected $keyType = 'string';
    public $incrementing = false;
    public $timestamps = false;

    protected $fillable = [
        'id', 'user_id', 'type', 'title', 'body', 'data', 'is_read',
    ];

    protected $casts = [
        'data' => 'json',
        'is_read' => 'boolean',
        'created_at' => 'datetime',
    ];

    public function user()
    {
        return $this->belongsTo(Profile::class, 'user_id', 'id');
    }
}
