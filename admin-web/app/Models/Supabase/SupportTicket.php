<?php

namespace App\Models\Supabase;

use Illuminate\Database\Eloquent\Model;

class SupportTicket extends Model
{
    protected $connection = 'supabase';
    protected $table = 'support_tickets';
    protected $keyType = 'string';
    public $incrementing = false;
    public $timestamps = false;

    protected $fillable = ['id', 'user_id', 'status', 'subject', 'reference_id'];

    protected $casts = [
        'created_at' => 'datetime',
    ];

    public function user()
    {
        return $this->belongsTo(Profile::class, 'user_id', 'id');
    }

    public function messages()
    {
        return $this->hasMany(SupportMessage::class, 'ticket_id', 'id');
    }
}
