<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class EmailLog extends Model
{
    use HasFactory;

    protected $connection = 'mysql';

    protected $table = 'email_logs';

    protected $fillable = [
        'recipient_email',
        'recipient_name',
        'subject',
        'template_key',
        'status',
        'error_message',
        'rendered_body',
        'metadata',
        'sent_at',
    ];

    protected $casts = [
        'metadata' => 'array',
        'sent_at' => 'datetime',
    ];

    public function template()
    {
        return $this->belongsTo(EmailTemplate::class, 'template_key', 'key');
    }
}
