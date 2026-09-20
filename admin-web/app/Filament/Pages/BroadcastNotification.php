<?php

namespace App\Filament\Pages;

use App\Models\Supabase\Notification;
use App\Models\Supabase\Profile;
use App\Models\Supabase\PushToken;
use App\Services\ExpoPushService;
use App\Services\NotificationService;
use Filament\Forms;
use Filament\Forms\Concerns\InteractsWithForms;
use Filament\Forms\Contracts\HasForms;
use Filament\Notifications\Notification as FilamentNotification;
use Filament\Pages\Page;
use Filament\Schemas\Components\Section;
use Filament\Schemas\Schema;
use Illuminate\Support\Str;

class BroadcastNotification extends Page implements HasForms
{
    use InteractsWithForms;

    protected static string | \BackedEnum | null $navigationIcon = 'heroicon-o-megaphone';
    protected static string | \UnitEnum | null $navigationGroup = 'Communications';
    protected static ?string $navigationLabel = 'Broadcast & Announcements';
    protected static ?string $title = 'Broadcast Announcement';
    protected static ?int $navigationSort = 3;

    protected string $view = 'filament.pages.broadcast-notification';

    public ?array $data = [];

    public function mount(): void
    {
        $this->form->fill([
            'target' => 'all',
            'type' => 'admin_announcement',
            'send_email' => true,
            'action_button_text' => 'Open GoRide App',
            'action_button_url' => 'https://goride.app',
        ]);
    }

    public function form(Schema $schema): Schema
    {
        return $schema
            ->components([
                Section::make('Compose Broadcast')
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
                            ->label('Announcement Title / Email Subject')
                            ->required()
                            ->maxLength(255)
                            ->placeholder('e.g. 🎉 Special Weekend Promo!'),

                        Forms\Components\Textarea::make('body')
                            ->label('Message Content')
                            ->required()
                            ->rows(5)
                            ->maxLength(2000)
                            ->placeholder('Write your announcement or promo message here...'),

                        Forms\Components\TextInput::make('deep_link_screen')
                            ->label('Mobile App Deep Link Screen (optional)')
                            ->placeholder('e.g. promo, wallet, home')
                            ->helperText('The screen to open when tapped on mobile.'),
                    ]),

                Section::make('Transactional Email Delivery')
                    ->description('Deliver this message directly to user inboxes using the configured SMTP server.')
                    ->icon('heroicon-o-envelope')
                    ->schema([
                        Forms\Components\Toggle::make('send_email')
                            ->label('Also Send via Transactional Email')
                            ->helperText('When enabled, each recipient with an email address will receive a formatted GoRide announcement email.')
                            ->default(true),

                        Forms\Components\TextInput::make('action_button_text')
                            ->label('Call To Action Button Text')
                            ->placeholder('e.g. Claim Offer / View Updates')
                            ->default('Open GoRide App'),

                        Forms\Components\TextInput::make('action_button_url')
                            ->label('Call To Action Link URL')
                            ->url()
                            ->placeholder('https://goride.app')
                            ->default('https://goride.app'),
                    ])->columns(2),
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

        $profiles = $query->get(['id', 'email', 'first_name', 'last_name']);
        $userIds = $profiles->pluck('id');
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

        $emailCount = 0;
        if (!empty($data['send_email'])) {
            $recipients = [];
            foreach ($profiles as $p) {
                if (!empty($p->email) && filter_var($p->email, FILTER_VALIDATE_EMAIL)) {
                    $recipients[] = [
                        'email' => $p->email,
                        'name' => $p->full_name ?: 'Valued Rider',
                    ];
                }
            }

            if (!empty($recipients)) {
                $emailRes = NotificationService::sendAnnouncement(
                    recipients: $recipients,
                    title: $data['title'],
                    body: $data['body'],
                    actionUrl: $data['action_button_url'] ?? null,
                    actionText: $data['action_button_text'] ?? null
                );
                $emailCount = $emailRes['sent'];
            }
        }

        $this->form->fill();

        FilamentNotification::make()
            ->title('Broadcast Dispatched!')
            ->body("Created {$sentCount} in-app alerts, sent {$pushCount} push messages, and delivered {$emailCount} emails.")
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
                ->modalDescription('This will dispatch in-app notifications, push notifications, and emails to all targeted users. Are you sure?')
                ->modalSubmitActionLabel('Yes, Send Broadcast'),
        ];
    }
}
