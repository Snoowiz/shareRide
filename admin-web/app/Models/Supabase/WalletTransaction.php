<?php

namespace App\Models\Supabase;

use Illuminate\Database\Eloquent\Model;

class WalletTransaction extends Model
{
    protected $connection = 'supabase';
    protected $table = 'wallet_transactions';
    protected $keyType = 'string';
    public $incrementing = false;
    public $timestamps = false;

    protected $fillable = [
        'id', 'wallet_id', 'type', 'amount', 'description',
        'reference_id', 'status', 'paystack_reference', 'payment_gateway', 'gateway_reference', 'delivery_id', 'category',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'created_at' => 'datetime',
    ];

    public function wallet()
    {
        return $this->belongsTo(Wallet::class, 'wallet_id', 'id');
    }

    public function ride()
    {
        return $this->belongsTo(Ride::class, 'reference_id', 'id');
    }

    public function delivery()
    {
        return $this->belongsTo(Delivery::class, 'delivery_id', 'id');
    }
}
