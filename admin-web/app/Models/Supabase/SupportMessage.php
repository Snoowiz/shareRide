<?php

namespace App\Models\Supabase;

use Illuminate\Database\Eloquent\Model;

class SupportMessage extends Model
{
    protected $connection = 'supabase';
    protected $table = 'support_messages';
    protected $keyType = 'string';
    public $incrementing = false;
    public $timestamps = false;

    protected $fillable = ['id', 'ticket_id', 'sender_id', 'message', 'attachment_url'];

    protected $casts = [
        'created_at' => 'datetime',
    ];

    public function ticket()
    {
        return $this->belongsTo(SupportTicket::class, 'ticket_id', 'id');
    }
}
