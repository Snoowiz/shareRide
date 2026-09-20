<?php

namespace App\Filament\Pages;

use Filament\Pages\Page;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Forms\Concerns\InteractsWithForms;
use Filament\Forms\Contracts\HasForms;
use App\Models\Supabase\Setting;
use Filament\Notifications\Notification;
use Filament\Actions\Action;

use Filament\Schemas\Schema;

class ManageSettings extends Page implements HasForms
{
    use InteractsWithForms;

    protected static string | \BackedEnum | null $navigationIcon = 'heroicon-o-cog-6-tooth';
    protected static string | \UnitEnum | null $navigationGroup = 'Settings';
    protected static ?string $navigationLabel = 'Platform Settings';
    protected static ?string $title = 'Platform Settings';
    protected static ?int $navigationSort = 1;

    protected string $view = 'filament.pages.manage-settings';

    public ?array $data = [];

    public function mount(): void
    {
        try {
            $settings = Setting::all()->pluck('value', 'key')->toArray();
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning('ManageSettings::mount failed to load settings: ' . $e->getMessage());
            $settings = [];
        }

        $defaults = [
            'paystack_enabled' => true,
            'paystack_mode' => 'test',
            'paystack_currency' => 'NGN',
            'paystack_public_key' => '',
            'paystack_secret_key' => '',
            'flutterwave_enabled' => false,
            'flutterwave_mode' => 'test',
            'flutterwave_public_key' => '',
            'flutterwave_secret_key' => '',
            'flutterwave_encryption_key' => '',
            'flutterwave_webhook_hash' => '',
            'flutterwave_currency' => 'NGN',
            'enable_cash_payments' => true,
            'enable_wallet_payments' => true,
            'min_wallet_topup' => 500,
            'min_driver_withdrawal' => 1000,
            'mail_mailer' => env('MAIL_MAILER', 'smtp'),
            'smtp_host' => env('MAIL_HOST', '127.0.0.1'),
            'smtp_port' => env('MAIL_PORT', 2525),
            'smtp_username' => env('MAIL_USERNAME', ''),
            'smtp_password' => env('MAIL_PASSWORD', ''),
            'smtp_encryption' => env('MAIL_ENCRYPTION', 'tls'),
            'smtp_from_address' => env('MAIL_FROM_ADDRESS', 'no-reply@goride.app'),
            'smtp_from_name' => env('MAIL_FROM_NAME', 'GoRide'),
        ];

        $this->form->fill(array_merge($defaults, $settings));
    }

    public function form(Schema $schema): Schema
    {
        return $schema
            ->components([
                \Filament\Schemas\Components\Tabs::make('Settings')
                    ->tabs([
                        \Filament\Schemas\Components\Tabs\Tab::make('General')
                            ->icon('heroicon-o-adjustments-horizontal')
                            ->schema([
                                Forms\Components\Toggle::make('maintenance_mode')
                                    ->label('Maintenance Mode')
                                    ->helperText('When enabled, the mobile app will show a maintenance screen.'),
                                Forms\Components\TextInput::make('search_radius_km')
                                    ->label('Search Radius (km)')
                                    ->numeric()
                                    ->helperText('The maximum radius to search for drivers.'),
                                Forms\Components\TextInput::make('driver_acceptance_timeout')
                                    ->label('Driver Acceptance Timeout (seconds)')
                                    ->numeric()
                                    ->default(30)
                                    ->helperText('How long a driver has to accept a ride/delivery request.'),
                                Forms\Components\TagsInput::make('vehicle_categories')
                                    ->label('Vehicle Categories')
                                    ->helperText('Available vehicle types for rides and deliveries.'),
                                Forms\Components\TagsInput::make('parcel_categories')
                                    ->label('Parcel Categories')
                                    ->helperText('Available parcel types for deliveries (e.g. Documents, Food, Electronics).'),
                            ]),
                        \Filament\Schemas\Components\Tabs\Tab::make('Pricing & Fees')
                            ->icon('heroicon-o-currency-dollar')
                            ->schema([
                                Forms\Components\TextInput::make('platform_fee_percentage')
                                    ->label('Platform Fee (%)')
                                    ->numeric()
                                    ->suffix('%'),
                                Forms\Components\TextInput::make('base_fare_car')
                                    ->label('Base Fare (Car)')
                                    ->numeric()
                                    ->prefix('NGN'),
                                Forms\Components\TextInput::make('base_fare_bike')
                                    ->label('Base Fare (Bike)')
                                    ->numeric()
                                    ->prefix('NGN'),
                                Forms\Components\Toggle::make('enable_dynamic_pricing')
                                    ->label('Enable Dynamic Surge Pricing')
                                    ->helperText('Automatically apply surge multipliers during high demand.'),
                                Forms\Components\TextInput::make('max_surge_multiplier')
                                    ->label('Max Surge Multiplier')
                                    ->numeric()
                                    ->step(0.1)
                                    ->default(2.5),
                            ]),
                        \Filament\Schemas\Components\Tabs\Tab::make('Payment Gateways')
                            ->icon('heroicon-o-credit-card')
                            ->schema([
                                \Filament\Schemas\Components\Section::make('Paystack Gateway')
                                    ->description('Configure Paystack for mobile app settlements, package deliveries, and wallet top-ups.')
                                    ->icon('heroicon-o-banknotes')
                                    ->columns(2)
                                    ->schema([
                                        Forms\Components\Toggle::make('paystack_enabled')
                                            ->label('Enable Paystack Gateway')
                                            ->helperText('Enable or disable Paystack payments across the mobile app.')
                                            ->default(true),
                                        Forms\Components\Select::make('paystack_mode')
                                            ->label('Environment Mode')
                                            ->options([
                                                'test' => 'Test Mode (Sandbox)',
                                                'live' => 'Live Mode (Production)',
                                            ])
                                            ->default('test')
                                            ->required(),
                                        Forms\Components\TextInput::make('paystack_public_key')
                                            ->label('Paystack Public Key')
                                            ->placeholder('pk_test_... or pk_live_...')
                                            ->helperText('Used by the mobile app to initialize card & transfer payment sheets.')
                                            ->columnSpan(1),
                                        Forms\Components\TextInput::make('paystack_secret_key')
                                            ->label('Paystack Secret Key')
                                            ->placeholder('sk_test_... or sk_live_...')
                                            ->password()
                                            ->revealable()
                                            ->helperText('Used by the server to verify payments. Kept strictly private.')
                                            ->columnSpan(1),
                                        Forms\Components\Select::make('paystack_currency')
                                            ->label('Transaction Currency')
                                            ->options([
                                                'NGN' => 'Nigerian Naira (NGN ₦)',
                                                'GHS' => 'Ghanaian Cedi (GHS ₵)',
                                                'KES' => 'Kenyan Shilling (KES KSh)',
                                                'USD' => 'US Dollar (USD $)',
                                            ])
                                            ->default('NGN'),
                                        Forms\Components\TextInput::make('paystack_merchant_email')
                                            ->label('Merchant Support Email')
                                            ->placeholder('payments@goride.app')
                                            ->email()
                                            ->helperText('Displayed on Paystack payment receipts.'),
                                    ]),

                                \Filament\Schemas\Components\Section::make('Flutterwave Gateway')
                                    ->description('Configure Flutterwave for card, mobile money, and USSD payments across Africa and internationally.')
                                    ->icon('heroicon-o-credit-card')
                                    ->columns(2)
                                    ->schema([
                                        Forms\Components\Toggle::make('flutterwave_enabled')
                                            ->label('Enable Flutterwave Gateway')
                                            ->helperText('Enable or disable Flutterwave payments across the mobile app.')
                                            ->default(false),
                                        Forms\Components\Select::make('flutterwave_mode')
                                            ->label('Environment Mode')
                                            ->options([
                                                'test' => 'Test Mode (Sandbox)',
                                                'live' => 'Live Mode (Production)',
                                            ])
                                            ->default('test')
                                            ->required(),
                                        Forms\Components\TextInput::make('flutterwave_public_key')
                                            ->label('Flutterwave Public Key')
                                            ->placeholder('FLWPUBK_TEST-... or FLWPUBK-...')
                                            ->helperText('Used by the mobile app to initialize Flutterwave hosted checkout.')
                                            ->columnSpan(1),
                                        Forms\Components\TextInput::make('flutterwave_secret_key')
                                            ->label('Flutterwave Secret Key')
                                            ->placeholder('FLWSECK_TEST-... or FLWSECK-...')
                                            ->password()
                                            ->revealable()
                                            ->helperText('Used by the backend to verify transactions. Kept strictly private.')
                                            ->columnSpan(1),
                                        Forms\Components\TextInput::make('flutterwave_encryption_key')
                                            ->label('Flutterwave Encryption Key')
                                            ->placeholder('FLWSECK_...')
                                            ->password()
                                            ->revealable()
                                            ->helperText('Optional encryption key for card tokenization / direct charges.')
                                            ->columnSpan(1),
                                        Forms\Components\TextInput::make('flutterwave_webhook_hash')
                                            ->label('Secret Webhook Hash')
                                            ->placeholder('Your secret hash for verif-hash validation')
                                            ->password()
                                            ->revealable()
                                            ->helperText('Secret hash configured in Flutterwave Webhooks dashboard for signature verification.')
                                            ->columnSpan(1),
                                        Forms\Components\Select::make('flutterwave_currency')
                                            ->label('Transaction Currency')
                                            ->options([
                                                'NGN' => 'Nigerian Naira (NGN ₦)',
                                                'USD' => 'US Dollar (USD $)',
                                                'GHS' => 'Ghanaian Cedi (GHS ₵)',
                                                'KES' => 'Kenyan Shilling (KES KSh)',
                                                'ZAR' => 'South African Rand (ZAR R)',
                                                'RWF' => 'Rwandan Franc (RWF RF)',
                                            ])
                                            ->default('NGN'),
                                    ]),

                                \Filament\Schemas\Components\Section::make('Cash & Wallet Operations')
                                    ->description('Configure offline cash settlements and internal wallet operations.')
                                    ->icon('heroicon-o-wallet')
                                    ->columns(2)
                                    ->schema([
                                        Forms\Components\Toggle::make('enable_cash_payments')
                                            ->label('Enable Cash on Delivery / Ride')
                                            ->helperText('Allow passengers and parcel senders to pay drivers directly in cash.')
                                            ->default(true),
                                        Forms\Components\Toggle::make('enable_wallet_payments')
                                            ->label('Enable In-App Wallet')
                                            ->helperText('Allow users and drivers to pay and receive earnings via wallet balance.')
                                            ->default(true),
                                        Forms\Components\TextInput::make('min_wallet_topup')
                                            ->label('Minimum Wallet Top-up')
                                            ->numeric()
                                            ->prefix('NGN')
                                            ->default(500),
                                        Forms\Components\TextInput::make('min_driver_withdrawal')
                                            ->label('Minimum Driver Withdrawal')
                                            ->numeric()
                                            ->prefix('NGN')
                                            ->default(1000),
                                    ]),
                            ]),
                        \Filament\Schemas\Components\Tabs\Tab::make('Email & SMTP Settings')
                            ->icon('heroicon-o-envelope')
                            ->schema([
                                \Filament\Schemas\Components\Section::make('SMTP Transport Configuration')
                                    ->description('Configure your transactional email server (Mailtrap, SendGrid, Postmark, AWS SES, or private SMTP).')
                                    ->icon('heroicon-o-server-stack')
                                    ->columns(2)
                                    ->schema([
                                        Forms\Components\Select::make('mail_mailer')
                                            ->label('Mail Driver')
                                            ->options([
                                                'smtp' => 'SMTP (Standard Network Mailer)',
                                                'log' => 'Log Driver (Local Testing - logs to laravel.log)',
                                            ])
                                            ->default('smtp')
                                            ->required(),
                                        Forms\Components\Select::make('smtp_encryption')
                                            ->label('Encryption Protocol')
                                            ->options([
                                                'tls' => 'TLS (Recommended - Port 587)',
                                                'ssl' => 'SSL (Port 465)',
                                                'none' => 'None / Plain (Port 25 or 2525)',
                                            ])
                                            ->default('tls'),
                                        Forms\Components\TextInput::make('smtp_host')
                                            ->label('SMTP Host Server')
                                            ->placeholder('smtp.mailtrap.io or smtp.sendgrid.net')
                                            ->required()
                                            ->columnSpan(1),
                                        Forms\Components\TextInput::make('smtp_port')
                                            ->label('SMTP Port')
                                            ->numeric()
                                            ->placeholder('587, 465, or 2525')
                                            ->required()
                                            ->columnSpan(1),
                                        Forms\Components\TextInput::make('smtp_username')
                                            ->label('SMTP Username / API Key')
                                            ->placeholder('smtp_username_here')
                                            ->columnSpan(1),
                                        Forms\Components\TextInput::make('smtp_password')
                                            ->label('SMTP Password / Secret')
                                            ->password()
                                            ->revealable()
                                            ->placeholder('••••••••••••')
                                            ->columnSpan(1),
                                    ]),

                                \Filament\Schemas\Components\Section::make('Sender Identity')
                                    ->description('Default address and display name attached to all outgoing transactional emails.')
                                    ->icon('heroicon-o-user-circle')
                                    ->columns(2)
                                    ->schema([
                                        Forms\Components\TextInput::make('smtp_from_address')
                                            ->label('From Email Address')
                                            ->email()
                                            ->placeholder('no-reply@goride.app')
                                            ->required(),
                                        Forms\Components\TextInput::make('smtp_from_name')
                                            ->label('From Display Name')
                                            ->placeholder('GoRide Notifications')
                                            ->required(),
                                    ]),
                            ]),
                        \Filament\Schemas\Components\Tabs\Tab::make('Features')
                            ->icon('heroicon-o-sparkles')
                            ->schema([
                                Forms\Components\Toggle::make('feature_live_chat')
                                    ->label('Enable Live Support Chat')
                                    ->default(true),
                                Forms\Components\Toggle::make('feature_wallet_transfers')
                                    ->label('Enable User-to-User Wallet Transfers')
                                    ->default(false),
                                Forms\Components\Toggle::make('feature_promo_codes')
                                    ->label('Enable Promo Codes')
                                    ->default(true),
                            ]),
                    ])->columnSpanFull()
            ])
            ->statePath('data');
    }

    public function save(): void
    {
        $data = $this->form->getState();

        foreach ($data as $key => $value) {
            Setting::updateOrCreate(
                ['key' => $key],
                ['value' => $value ?? '']
            );
        }

        // Bust payment gateway caches so new credentials immediately take effect
        \Illuminate\Support\Facades\Cache::forget('paystack_gateway_settings');
        \Illuminate\Support\Facades\Cache::forget('flutterwave_gateway_settings');

        Notification::make()
            ->title('Settings updated successfully')
            ->success()
            ->send();
    }

    protected function getHeaderActions(): array
    {
        return [
            Action::make('testPaystack')
                ->label('Test Paystack')
                ->icon('heroicon-o-banknotes')
                ->color('success')
                ->action(function () {
                    // Flush cache to test with latest saved settings
                    \Illuminate\Support\Facades\Cache::forget('paystack_gateway_settings');
                    $gateway = new \App\Services\Payment\PaystackGateway();
                    $res = $gateway->testConnection();

                    if ($res['success']) {
                        Notification::make()
                            ->title('Paystack Connection Successful!')
                            ->body($res['message'])
                            ->success()
                            ->send();
                    } else {
                        Notification::make()
                            ->title('Paystack Test Failed')
                            ->body($res['message'])
                            ->danger()
                            ->send();
                    }
                }),

            Action::make('testFlutterwave')
                ->label('Test Flutterwave')
                ->icon('heroicon-o-credit-card')
                ->color('warning')
                ->action(function () {
                    // Flush cache to test with latest saved settings
                    \Illuminate\Support\Facades\Cache::forget('flutterwave_gateway_settings');
                    $gateway = new \App\Services\Payment\FlutterwaveGateway();
                    $res = $gateway->testConnection();

                    if ($res['success']) {
                        Notification::make()
                            ->title('Flutterwave Connection Successful!')
                            ->body($res['message'])
                            ->success()
                            ->send();
                    } else {
                        Notification::make()
                            ->title('Flutterwave Test Failed')
                            ->body($res['message'])
                            ->danger()
                            ->send();
                    }
                }),

            Action::make('testSmtp')
                ->label('Test SMTP Connection')
                ->icon('heroicon-o-paper-airplane')
                ->color('info')
                ->modalHeading('Send Live SMTP Test Email')
                ->modalDescription('Verify your SMTP credentials and delivery by sending an immediate diagnostic message.')
                ->form([
                    Forms\Components\TextInput::make('test_email')
                        ->label('Recipient Email Address')
                        ->email()
                        ->required()
                        ->default(auth()->user()?->email ?? 'admin@goride.app')
                        ->helperText('A real diagnostic message will be dispatched to this address to verify connectivity.'),
                ])
                ->action(function (array $data) {
                    $res = \App\Services\NotificationService::testSmtpConnection($data['test_email']);
                    if ($res['success']) {
                        Notification::make()
                            ->title('SMTP Test Succeeded!')
                            ->body("A diagnostic test message was successfully dispatched to {$data['test_email']}.")
                            ->success()
                            ->send();
                    } else {
                        Notification::make()
                            ->title('SMTP Test Failed')
                            ->body($res['message'])
                            ->danger()
                            ->persistent()
                            ->send();
                    }
                }),
        ];
    }

    protected function getFormActions(): array
    {
        return [
            Action::make('save')
                ->label('Save settings')
                ->submit('save')
                ->keyBindings(['mod+s']),
        ];
    }
}
