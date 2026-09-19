<?php

namespace App\Models\Supabase;

use Illuminate\Database\Eloquent\Model;

class Wallet extends Model
{
    protected $connection = 'supabase';
    protected $table = 'wallets';
    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = ['id', 'balance', 'currency'];

    protected $casts = [
        'balance' => 'decimal:2',
        'updated_at' => 'datetime',
    ];

    public $timestamps = false;

    public function profile()
    {
        return $this->belongsTo(Profile::class, 'id', 'id');
    }

    public function transactions()
    {
        return $this->hasMany(WalletTransaction::class, 'wallet_id', 'id');
    }
}
