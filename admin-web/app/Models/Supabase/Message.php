<?php

namespace App\Models\Supabase;

use Illuminate\Database\Eloquent\Model;

class Message extends Model
{
    protected $connection = 'supabase';
    protected $table = 'messages';
    protected $keyType = 'string';
    public $incrementing = false;
    public $timestamps = false;

    protected $fillable = [
        'id', 'ride_id', 'sender_id', 'receiver_id', 'content', 'is_read', 'delivery_id',
    ];

    protected $casts = [
        'is_read' => 'boolean',
        'created_at' => 'datetime',
    ];
}
