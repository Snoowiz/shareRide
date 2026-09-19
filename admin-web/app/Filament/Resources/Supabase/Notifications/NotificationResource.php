<?php

namespace App\Filament\Resources\Supabase\Notifications;

use App\Filament\Resources\Supabase\Notifications\Pages\CreateNotification;
use App\Filament\Resources\Supabase\Notifications\Pages\EditNotification;
use App\Filament\Resources\Supabase\Notifications\Pages\ListNotifications;
use App\Filament\Resources\Supabase\Notifications\Schemas\NotificationForm;
use App\Filament\Resources\Supabase\Notifications\Tables\NotificationsTable;
use App\Models\Supabase\Notification;
use BackedEnum;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Table;

class NotificationResource extends Resource
{
    protected static ?string $model = Notification::class;

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedBell;

    protected static \UnitEnum|string|null $navigationGroup = 'Operations';

    public static function canAccess(): bool
    {
        return auth()->user()?->can('send_push_notifications') ?? false;
    }


    public static function form(Schema $schema): Schema
    {
        return NotificationForm::configure($schema);
    }

    public static function table(Table $table): Table
    {
        return NotificationsTable::configure($table);
    }

    public static function getRelations(): array
    {
        return [
            //
        ];
    }

    public static function getPages(): array
    {
        return [
            'index' => ListNotifications::route('/'),
            'create' => CreateNotification::route('/create'),
            'edit' => EditNotification::route('/{record}/edit'),
        ];
    }
}
