<?php

namespace App\Filament\Resources\Supabase\Notifications\Schemas;

use Filament\Schemas\Schema;

class NotificationForm
{
    public static function configure(Schema $schema): Schema
    {
        return $schema
            ->components([
                \Filament\Schemas\Components\Select::make('user_id')
                    ->relationship('user', 'full_name')
                    ->searchable()
                    ->required(),
                \Filament\Schemas\Components\TextInput::make('type')
                    ->required()
                    ->maxLength(255)
                    ->default('system'),
                \Filament\Schemas\Components\TextInput::make('title')
                    ->required()
                    ->maxLength(255),
                \Filament\Schemas\Components\Textarea::make('body')
                    ->required()
                    ->maxLength(65535)
                    ->columnSpanFull(),
                \Filament\Schemas\Components\KeyValue::make('data')
                    ->keyLabel('Payload Key')
                    ->valueLabel('Payload Value')
                    ->columnSpanFull(),
            ]);
    }
}
