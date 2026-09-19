<?php

namespace App\Models\Supabase;

use Illuminate\Database\Eloquent\Model;

class Rating extends Model
{
    protected $connection = 'supabase';
    protected $table = 'ratings';
    protected $keyType = 'string';
    public $incrementing = false;
    public $timestamps = false;

    protected $fillable = ['id', 'ride_id', 'rater_id', 'rated_id', 'rating', 'feedback', 'tags'];

    protected $casts = [
        'rating' => 'integer',
        'tags' => 'array',
        'created_at' => 'datetime',
    ];

    public function ride()
    {
        return $this->belongsTo(Ride::class, 'ride_id', 'id');
    }

    public function rater()
    {
        return $this->belongsTo(Profile::class, 'rater_id', 'id');
    }

    public function rated()
    {
        return $this->belongsTo(Profile::class, 'rated_id', 'id');
    }
}
