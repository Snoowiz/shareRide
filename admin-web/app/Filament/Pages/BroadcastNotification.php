<?php

namespace App\Filament\Pages;

use App\Models\Supabase\Notification;
use App\Models\Supabase\Profile;
use App\Models\Supabase\PushToken;
use App\Services\ExpoPushService;
use Filament\Forms;
use Filament\Forms\Concerns\InteractsWithForms;
use Filament\Forms\Contracts\HasForms;
use Filament\Notifications\Notification as FilamentNotification;
use Filament\Pages\Page;
use Filament\Schemas\Schema;
use Illuminate\Support\Str;

class BroadcastNotification extends Page implements HasForms
{
    use InteractsWithForms;

    protected static string | \BackedEnum | null $navigationIcon = 'heroicon-o-megaphone';
    protected static string | \UnitEnum | null $navigationGroup = 'Operations';
    protected static ?string $navigationLabel = 'Broadcast';
    protected static ?string $title = 'Broadcast Notification';
    protected static ?int $navigationSort = 5;

    protected string $view = 'filament.pages.broadcast-notification';

    public ?array $data = [];

    public function mount(): void
    {
        $this->form->fill();
    }

    public function form(Schema $schema): Schema
    {
        return $schema
            ->components([
                Forms\Components\Section::make('Compose Broadcast')
                    ->schema([
                        Forms\Components\Select::make('target')
                            ->label('Target Audience')
                            ->options([
                                'all' => '📢 All Users (Riders + Drivers)',
                                'riders' => '🧑 All Riders',
                                'drivers' => '🚗 All Drivers',
                            ])
                            ->required()
                            ->default('all'),

                        Forms\Components\Select::make('type')
                            ->label('Notification Type')
                            ->options([
                                'admin_announcement' => 'Admin Announcement',
                                'promo' => 'Promo Campaign',
                                'system' => 'System Alert',
                            ])
                            ->required()
                            ->default('admin_announcement'),

                        Forms\Components\TextInput::make('title')
                            ->required()
                            ->maxLength(255)
                            ->placeholder('e.g. 🎉 Weekend Promo!'),

                        Forms\Components\Textarea::make('body')
                            ->required()
                            ->rows(4)
                            ->maxLength(1000)
                            ->placeholder('Write your broadcast message here...'),

                        Forms\Components\TextInput::make('deep_link_screen')
                            ->label('Deep Link Screen (optional)')
                            ->placeholder('e.g. promo, wallet, home')
                            ->helperText('The screen to navigate to when the user taps the notification.'),
                    ]),
            ])
            ->statePath('data');
    }

    public function send(): void
    {
        $data = $this->form->getState();

        // Determine target users
        $query = Profile::query();
        if ($data['target'] === 'riders') {
            $query->where('role', 'user');
        } elseif ($data['target'] === 'drivers') {
            $query->where('role', 'driver');
        }

        $userIds = $query->pluck('id');
        $sentCount = 0;
        $pushCount = 0;

        foreach ($userIds as $userId) {
            // Create in-app notification record
            Notification::create([
                'id' => Str::uuid()->toString(),
                'user_id' => $userId,
                'type' => $data['type'],
                'title' => $data['title'],
                'body' => $data['body'],
                'data' => json_encode(array_filter([
                    'screen' => $data['deep_link_screen'] ?? null,
                ])),
                'is_read' => false,
            ]);
            $sentCount++;

            // Send push notifications via Expo
            $tokens = PushToken::where('user_id', $userId)
                ->where('is_active', true)
                ->pluck('token');

            foreach ($tokens as $token) {
                ExpoPushService::sendPushNotification(
                    $token,
                    $data['title'],
                    $data['body'],
                    array_filter([
                        'type' => $data['type'],
                        'route' => $data['deep_link_screen'] ?? null,
                    ])
                );
                $pushCount++;
            }
        }

        $this->form->fill();

        FilamentNotification::make()
            ->title('Broadcast Sent!')
            ->body("Created {$sentCount} notifications and sent {$pushCount} push messages.")
            ->success()
            ->send();
    }

    protected function getFormActions(): array
    {
        return [
            \Filament\Actions\Action::make('send')
                ->label('🚀 Send Broadcast')
                ->color('primary')
                ->submit('send')
                ->requiresConfirmation()
                ->modalHeading('Confirm Broadcast')
                ->modalDescription('This will send a notification to all targeted users. Are you sure?')
                ->modalSubmitActionLabel('Yes, Send'),
        ];
    }
}
