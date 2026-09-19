<?php

namespace App\Filament\Resources\SupportTicketResource\Pages;

use App\Filament\Resources\SupportTicketResource;
use App\Models\Supabase\SupportMessage;
use Filament\Actions;
use Filament\Forms;
use Filament\Notifications\Notification;
use Filament\Resources\Pages\ViewRecord;
use Filament\Infolists\Components\ImageEntry;
use Filament\Infolists\Components\RepeatableEntry;
use Filament\Schemas\Components\Section;
use Filament\Infolists\Components\TextEntry;
use Filament\Infolists\Components\ViewEntry;
use Filament\Schemas\Schema;

class ViewSupportTicket extends ViewRecord
{
    protected static string $resource = SupportTicketResource::class;

    public function infolist(Schema $schema): Schema
    {
        return $schema->components([
            Section::make('Ticket Information')
                ->columns(3)
                ->schema([
                    TextEntry::make('id')->label('Ticket ID')->copyable(),
                    TextEntry::make('subject'),
                    TextEntry::make('status')
                        ->badge()
                        ->color(fn(?string $state) => $state === 'open' ? 'warning' : 'success'),
                    TextEntry::make('user.first_name')
                        ->label('User')
                        ->formatStateUsing(fn($record) => $record->user?->full_name ?? 'N/A'),
                    TextEntry::make('created_at')->dateTime('M d, Y h:i A'),
                ]),
            Section::make('Messages')
                ->schema([
                    RepeatableEntry::make('messages')
                        ->schema([
                            TextEntry::make('message')->columnSpanFull(),
                            ViewEntry::make('attachment_url')
                                ->label('Attachment')
                                ->hidden(fn ($state) => blank($state))
                                ->view('filament.resources.support-ticket.components.image-preview')
                                ->columnSpanFull(),
                            TextEntry::make('created_at')->dateTime('M d, Y h:i A')->size('sm')->color('gray'),
                        ])
                        ->columns(1),
                ]),
        ]);
    }

    protected function getHeaderActions(): array
    {
        return [
            Actions\Action::make('close')
                ->icon('heroicon-o-check-circle')
                ->color('success')
                ->requiresConfirmation()
                ->visible(fn() => $this->record->status === 'open')
                ->action(function () {
                    $this->record->update(['status' => 'closed']);
                    Notification::make()->title('Ticket closed')->success()->send();
                }),
        ];
    }

    protected function getHeaderWidgets(): array
    {
        return [];
    }

    protected function getFooterWidgets(): array
    {
        return [
            \App\Filament\Resources\SupportTicketResource\Widgets\TicketReplyWidget::class,
        ];
    }
}
