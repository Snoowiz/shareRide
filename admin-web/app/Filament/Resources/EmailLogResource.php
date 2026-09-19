<?php

namespace App\Filament\Resources;

use App\Filament\Resources\EmailLogResource\Pages;
use App\Models\EmailLog;
use App\Services\NotificationService;
use Filament\Forms;
use Filament\Notifications\Notification;
use Filament\Resources\Resource;
use Filament\Schemas\Components\Section;
use Filament\Schemas\Schema;
use Filament\Tables;
use Filament\Tables\Table;
use Filament\Infolists\Infolist;
use Filament\Infolists\Components\TextEntry;

class EmailLogResource extends Resource
{
    protected static ?string $model = EmailLog::class;
    protected static string | \BackedEnum | null $navigationIcon = 'heroicon-o-clipboard-document-list';
    protected static string | \UnitEnum | null $navigationGroup = 'Communications';
    protected static ?string $navigationLabel = 'Email Logs';
    protected static ?int $navigationSort = 2;

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                Tables\Columns\TextColumn::make('status')
                    ->label('Status')
                    ->badge()
                    ->color(fn (string $state): string => match ($state) {
                        'sent' => 'success',
                        'failed' => 'danger',
                        'queued' => 'warning',
                        default => 'gray',
                    }),

                Tables\Columns\TextColumn::make('recipient_email')
                    ->label('Recipient')
                    ->searchable()
                    ->copyable()
                    ->weight('bold'),

                Tables\Columns\TextColumn::make('recipient_name')
                    ->label('Name')
                    ->placeholder('N/A')
                    ->searchable(),

                Tables\Columns\TextColumn::make('subject')
                    ->label('Subject')
                    ->searchable()
                    ->limit(40),

                Tables\Columns\TextColumn::make('template_key')
                    ->label('Template')
                    ->badge()
                    ->color('primary')
                    ->placeholder('Raw / Custom'),

                Tables\Columns\TextColumn::make('sent_at')
                    ->label('Dispatched At')
                    ->dateTime('M d, Y h:i A')
                    ->placeholder('Pending / Not sent')
                    ->sortable(),

                Tables\Columns\TextColumn::make('created_at')
                    ->label('Logged At')
                    ->dateTime('M d, Y h:i A')
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
            ])
            ->defaultSort('id', 'desc')
            ->filters([
                Tables\Filters\SelectFilter::make('status')
                    ->options([
                        'sent' => 'Sent',
                        'failed' => 'Failed',
                        'queued' => 'Queued',
                    ]),
            ])
            ->actions([
                \Filament\Actions\ViewAction::make(),
                \Filament\Actions\Action::make('retry')
                    ->label('Resend')
                    ->icon('heroicon-o-arrow-path')
                    ->color('warning')
                    ->requiresConfirmation()
                    ->modalHeading('Resend Email')
                    ->modalDescription(fn (EmailLog $record) => "Attempt to re-dispatch this email to {$record->recipient_email}?")
                    ->action(function (EmailLog $record) {
                        $res = NotificationService::sendEmail(
                            toEmail: $record->recipient_email,
                            subject: $record->subject,
                            htmlBody: $record->rendered_body ?: '<p>No content recorded</p>',
                            recipientName: $record->recipient_name,
                            templateKey: $record->template_key,
                            metadata: ['retried_from_log_id' => $record->id]
                        );

                        if ($res['success']) {
                            Notification::make()
                                ->title('Email Re-dispatched Successfully')
                                ->success()
                                ->send();
                        } else {
                            Notification::make()
                                ->title('Resend Attempt Failed')
                                ->body($res['message'])
                                ->danger()
                                ->send();
                        }
                    }),
            ]);
    }

    public static function form(Schema $schema): Schema
    {
        return $schema
            ->components([
                Section::make('Email Delivery Details')
                    ->columns(3)
                    ->schema([
                        Forms\Components\TextInput::make('recipient_email')
                            ->label('Recipient Email')
                            ->disabled(),
                        Forms\Components\TextInput::make('recipient_name')
                            ->label('Recipient Name')
                            ->disabled(),
                        Forms\Components\TextInput::make('status')
                            ->label('Delivery Status')
                            ->disabled(),
                        Forms\Components\TextInput::make('subject')
                            ->label('Subject Line')
                            ->columnSpan(2)
                            ->disabled(),
                        Forms\Components\TextInput::make('template_key')
                            ->label('Template Key')
                            ->columnSpan(1)
                            ->disabled(),
                        Forms\Components\TextInput::make('sent_at')
                            ->label('Dispatched Timestamp')
                            ->disabled(),
                        Forms\Components\Textarea::make('error_message')
                            ->label('Error Diagnostic Message')
                            ->columnSpanFull()
                            ->visible(fn ($record) => !empty($record?->error_message))
                            ->disabled(),
                    ]),

                Section::make('Rendered HTML Content')
                    ->schema([
                        Forms\Components\Textarea::make('rendered_body')
                            ->label('Delivered HTML Body')
                            ->rows(14)
                            ->disabled()
                            ->columnSpanFull(),
                    ]),
            ]);
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListEmailLogs::route('/'),
            'view' => Pages\ViewEmailLog::route('/{record}'),
        ];
    }
}
