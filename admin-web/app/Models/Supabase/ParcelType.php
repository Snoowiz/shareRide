<?php

namespace App\Models\Supabase;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class ParcelType extends Model
{
    use HasFactory;

    protected $connection = 'supabase';
    protected $table = 'parcel_types';
    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = [
        'id',
        'code',
        'name',
        'description',
        'icon_name',
        'icon_svg',
        'display_order',
        'is_active',
    ];

    protected $casts = [
        'display_order' => 'integer',
        'is_active' => 'boolean',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    protected static function booted()
    {
        static::creating(function ($model) {
            if (empty($model->id)) {
                $model->id = (string) Str::uuid();
            }
            if (empty($model->code) && !empty($model->name)) {
                $model->code = Str::slug($model->name, '_');
            }
        });
    }

    /**
     * Associated deliveries using this parcel type.
     */
    public function deliveries()
    {
        return $this->hasMany(Delivery::class, 'parcel_type', 'code');
    }

    /**
     * Get count of deliveries with this parcel type.
     */
    public function getDeliveriesCountAttribute(): int
    {
        return $this->deliveries()->count();
    }
}
