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
        $this->form->fill($settings);
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
                ['value' => $value]
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
