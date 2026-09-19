<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class EmailTemplate extends Model
{
    use HasFactory;

    protected $connection = 'mysql';

    protected $table = 'email_templates';

    protected $fillable = [
        'key',
        'name',
        'subject',
        'body_html',
        'body_text',
        'variables',
        'is_active',
    ];

    protected $casts = [
        'variables' => 'array',
        'is_active' => 'boolean',
    ];

    /**
     * Render the template by replacing dynamic placeholders like {{key}} with given values.
     */
    public function render(array $data = []): array
    {
        $subject = $this->subject;
        $html = $this->body_html;
        $text = $this->body_text ?? '';

        foreach ($data as $key => $value) {
            $valStr = is_scalar($value) ? (string) $value : json_encode($value);
            $placeholder = '{{' . $key . '}}';
            $subject = str_replace($placeholder, $valStr, $subject);
            $html = str_replace($placeholder, $valStr, $html);
            $text = str_replace($placeholder, $valStr, $text);
        }

        return [
            'subject' => $subject,
            'html' => $html,
            'text' => $text,
        ];
    }
}
