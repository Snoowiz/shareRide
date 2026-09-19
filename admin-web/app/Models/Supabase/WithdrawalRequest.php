<?php

namespace App\Models\Supabase;

use Illuminate\Database\Eloquent\Model;

class WithdrawalRequest extends Model
{
    protected $connection = 'supabase';
    protected $table = 'withdrawal_requests';
    protected $keyType = 'string';
    public $incrementing = false;
    public $timestamps = false;

    protected $fillable = [
        'id', 'driver_id', 'amount', 'bank_name', 'account_number', 'account_name',
        'status', 'admin_note', 'requested_at', 'processed_at', 'wallet_transaction_id',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'created_at' => 'datetime',
        'requested_at' => 'datetime',
        'processed_at' => 'datetime',
    ];

    public function driver()
    {
        return $this->belongsTo(Profile::class, 'driver_id', 'id');
    }

    public function walletTransaction()
    {
        return $this->belongsTo(WalletTransaction::class, 'wallet_transaction_id', 'id');
    }
}
