<?php

namespace App\Filament\Resources;

use App\Filament\Resources\SupportTicketResource\Pages;
use App\Models\Supabase\SupportTicket;
use Filament\Forms;
use Filament\Notifications\Notification;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Tables;
use Filament\Tables\Table;

class SupportTicketResource extends Resource
{
    protected static ?string $model = SupportTicket::class;
    protected static string | \BackedEnum | null $navigationIcon = 'heroicon-o-chat-bubble-left-right';
    protected static string | \UnitEnum | null $navigationGroup = 'Support';
    protected static ?string $navigationLabel = 'Support Tickets';
    protected static ?int $navigationSort = 1;

    public static function canAccess(): bool
    {
        return auth()->user()?->can('view_support_tickets') ?? false;
    }

    public static function getEloquentQuery(): \Illuminate\Database\Eloquent\Builder
    {
        return parent::getEloquentQuery()->with(['user']);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                Tables\Columns\TextColumn::make('id')->label('ID')->limit(8)->copyable(),
                Tables\Columns\TextColumn::make('subject')->searchable()->limit(40),
                Tables\Columns\TextColumn::make('user.first_name')
                    ->label('User')
                    ->formatStateUsing(fn($record) => $record->user?->full_name ?? 'N/A'),
                Tables\Columns\TextColumn::make('status')
                    ->badge()
                    ->color(fn(?string $state) => match ($state) {
                        'open' => 'warning',
                        'closed' => 'success',
                        default => 'gray',
                    }),
                Tables\Columns\TextColumn::make('created_at')
                    ->dateTime('M d, Y h:i A')
                    ->sortable(),
            ])
            ->filters([
                Tables\Filters\SelectFilter::make('status')
                    ->options(['open' => 'Open', 'closed' => 'Closed']),
            ])
            ->actions([
                \Filament\Actions\ViewAction::make(),
                \Filament\Actions\Action::make('close')
                    ->icon('heroicon-o-check-circle')
                    ->color('success')
                    ->requiresConfirmation()
                    ->visible(fn($record) => $record->status === 'open')
                    ->action(function ($record) {
                        $record->update(['status' => 'closed']);
                        Notification::make()->title('Ticket closed')->success()->send();
                    }),
            ])
            ->defaultSort('created_at', 'desc');
    }

    public static function form(Schema $schema): Schema
    {
        return $schema->components([
            \Filament\Forms\Components\Section::make('Ticket Details')
                ->schema([
                    \Filament\Forms\Components\TextInput::make('id')->label('Ticket ID'),
                    \Filament\Forms\Components\TextInput::make('user.first_name')->label('User')->formatStateUsing(fn($record) => $record->user?->full_name ?? 'N/A'),
                    \Filament\Forms\Components\TextInput::make('subject')->label('Subject')->columnSpanFull(),
                    \Filament\Forms\Components\Textarea::make('description')->label('Description')->columnSpanFull(),
                    \Filament\Forms\Components\TextInput::make('status')->label('Status'),
                    \Filament\Forms\Components\TextInput::make('priority')->label('Priority'),
                    \Filament\Forms\Components\TextInput::make('created_at')->label('Created At'),
                ])->columns(2),
        ]);
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListSupportTickets::route('/'),
            'view' => Pages\ViewSupportTicket::route('/{record}'),
        ];
    }

    public static function getNavigationBadge(): ?string
    {
        return (string) SupportTicket::where('status', 'open')->count();
    }

    public static function getNavigationBadgeColor(): ?string
    {
        return SupportTicket::where('status', 'open')->count() > 0 ? 'danger' : 'success';
    }
}
