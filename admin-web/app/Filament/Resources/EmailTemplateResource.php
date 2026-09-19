<?php

namespace App\Filament\Resources;

use App\Filament\Resources\EmailTemplateResource\Pages;
use App\Models\EmailTemplate;
use App\Services\NotificationService;
use Filament\Forms;
use Filament\Notifications\Notification;
use Filament\Resources\Resource;
use Filament\Schemas\Components\Section;
use Filament\Schemas\Schema;
use Filament\Tables;
use Filament\Tables\Table;

class EmailTemplateResource extends Resource
{
    protected static ?string $model = EmailTemplate::class;
    protected static string | \BackedEnum | null $navigationIcon = 'heroicon-o-envelope-open';
    protected static string | \UnitEnum | null $navigationGroup = 'Communications';
    protected static ?string $navigationLabel = 'Email Templates';
    protected static ?int $navigationSort = 1;

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                Tables\Columns\TextColumn::make('name')
                    ->label('Template Name')
                    ->searchable()
                    ->weight('bold'),

                Tables\Columns\TextColumn::make('key')
                    ->label('Template Key')
                    ->badge()
                    ->color('primary')
                    ->copyable(),

                Tables\Columns\TextColumn::make('subject')
                    ->label('Default Subject')
                    ->searchable()
                    ->limit(45),

                Tables\Columns\IconColumn::make('is_active')
                    ->label('Active')
                    ->boolean(),

                Tables\Columns\TextColumn::make('updated_at')
                    ->label('Last Updated')
                    ->dateTime('M d, Y h:i A')
                    ->sortable(),
            ])
            ->actions([
                \Filament\Actions\EditAction::make(),
                \Filament\Actions\Action::make('testSend')
                    ->label('Test Send')
                    ->icon('heroicon-o-paper-airplane')
                    ->color('info')
                    ->modalHeading(fn (EmailTemplate $record) => "Send Test Email: {$record->name}")
                    ->modalDescription('Dispatches a live test email using this template with sample data.')
                    ->form([
                        Forms\Components\TextInput::make('recipient_email')
                            ->label('Recipient Email Address')
                            ->email()
                            ->required()
                            ->default(auth()->user()?->email ?? 'admin@goride.app'),
                    ])
                    ->action(function (EmailTemplate $record, array $data) {
                        $sampleVariables = [
                            'user_name' => 'GoRide Sample User',
                            'reset_link' => 'https://goride.app/reset-sample',
                            'otp_code' => '849201',
                            'expiry_minutes' => 30,
                            'ride_id' => 'RD-92810',
                            'status' => 'COMPLETED',
                            'driver_name' => 'Captain Michael',
                            'pickup_location' => 'Central Business District, Lagos',
                            'destination_location' => 'Victoria Island, Lagos',
                            'fare' => '3,500.00',
                            'payment_method' => 'Wallet',
                            'ticket_id' => 'TCK-4091',
                            'ticket_subject' => 'Billing inquiry regarding recent trip',
                            'ticket_category' => 'Billing',
                            'support_url' => 'goride://support/TCK-4091',
                            'admin_response' => 'We have investigated your trip and credited the fare discrepancy back to your wallet balance. Thank you for your patience.',
                            'ticket_status' => 'Resolved',
                            'announcement_title' => 'Important Service Expansion Update',
                            'announcement_body' => 'We are excited to announce 24/7 delivery services and expanded coverage zones across the metropolitan area!',
                            'action_button_text' => 'Explore Zones',
                            'action_button_url' => 'https://goride.app',
                            'role' => 'Rider',
                            'login_url' => 'https://goride.app',
                            'app_name' => 'GoRide',
                            'support_email' => 'support@goride.app',
                        ];

                        $result = NotificationService::sendTemplate(
                            templateKey: $record->key,
                            toEmail: $data['recipient_email'],
                            variables: $sampleVariables,
                            recipientName: 'Test Recipient'
                        );

                        if ($result['success']) {
                            Notification::make()
                                ->title('Test Email Dispatched!')
                                ->body("Successfully sent '{$record->name}' to {$data['recipient_email']}.")
                                ->success()
                                ->send();
                        } else {
                            Notification::make()
                                ->title('Delivery Failed')
                                ->body($result['message'])
                                ->danger()
                                ->persistent()
                                ->send();
                        }
                    }),
            ]);
    }

    public static function form(Schema $schema): Schema
    {
        return $schema
            ->components([
                Section::make('Template Details')
                    ->columns(2)
                    ->schema([
                        Forms\Components\TextInput::make('name')
                            ->label('Template Name')
                            ->required()
                            ->columnSpan(1),

                        Forms\Components\TextInput::make('key')
                            ->label('Identifier Key')
                            ->disabled(fn ($context) => $context === 'edit')
                            ->required()
                            ->columnSpan(1),

                        Forms\Components\TextInput::make('subject')
                            ->label('Email Subject')
                            ->required()
                            ->columnSpanFull(),

                        Forms\Components\Toggle::make('is_active')
                            ->label('Active Status')
                            ->helperText('When deactivated, automatic triggers for this template will be skipped.')
                            ->default(true),

                        Forms\Components\Placeholder::make('available_variables')
                            ->label('Dynamic Tokens Cheat Sheet')
                            ->content(function (?EmailTemplate $record) {
                                if (!$record || empty($record->variables)) {
                                    return 'No specific variables declared.';
                                }
                                $tokens = array_map(fn ($v) => "{{" . $v . "}}", $record->variables);
                                return implode('  •  ', $tokens);
                            })
                            ->columnSpanFull(),
                    ]),

                Section::make('HTML & Text Content')
                    ->schema([
                        Forms\Components\Textarea::make('body_html')
                            ->label('Responsive HTML Body')
                            ->rows(18)
                            ->required()
                            ->helperText('Full HTML email markup. Use {{token_name}} tags for dynamic variable injection.')
                            ->columnSpanFull(),

                        Forms\Components\Textarea::make('body_text')
                            ->label('Plaintext Fallback Body')
                            ->rows(6)
                            ->helperText('Alternative text version for clients that do not render rich HTML.')
                            ->columnSpanFull(),
                    ]),
            ]);
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListEmailTemplates::route('/'),
            'edit' => Pages\EditEmailTemplate::route('/{record}/edit'),
        ];
    }
}
