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
        $settings = Setting::all()->pluck('value', 'key')->toArray();

        $defaults = [
            'paystack_enabled' => true,
            'paystack_mode' => 'test',
            'paystack_currency' => 'NGN',
            'paystack_public_key' => env('EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY', ''),
            'enable_cash_payments' => true,
            'enable_wallet_payments' => true,
            'min_wallet_topup' => 500,
            'min_driver_withdrawal' => 1000,
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
                        \Filament\Schemas\Components\Tabs\Tab::make('Email Templates')
                            ->icon('heroicon-o-envelope')
                            ->schema([
                                Forms\Components\Textarea::make('email_template_welcome')
                                    ->label('Welcome Email'),
                                Forms\Components\Textarea::make('email_template_password_reset')
                                    ->label('Password Reset Email'),
                                Forms\Components\Textarea::make('email_template_deposit')
                                    ->label('Deposit Success Email'),
                                Forms\Components\Textarea::make('email_template_withdraw')
                                    ->label('Withdrawal Processed Email'),
                                Forms\Components\Textarea::make('email_template_support')
                                    ->label('Support Ticket Received Email'),
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

        Notification::make()
            ->title('Settings updated successfully')
            ->success()
            ->send();
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
