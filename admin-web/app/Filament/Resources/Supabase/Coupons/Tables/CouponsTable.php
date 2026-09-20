<?php

namespace App\Filament\Resources\Supabase\Coupons\Tables;

use Filament\Actions\BulkActionGroup;
use Filament\Actions\DeleteBulkAction;
use Filament\Actions\EditAction;
use Filament\Actions\DeleteAction;
use Filament\Tables;
use Filament\Tables\Table;

class CouponsTable
{
    public static function configure(Table $table): Table
    {
        return $table
            ->columns([
                Tables\Columns\TextColumn::make('code')
                    ->label('Code')
                    ->searchable()
                    ->sortable()
                    ->copyable()
                    ->weight('bold')
                    ->color('primary'),

                Tables\Columns\TextColumn::make('title')
                    ->label('Title & Headline')
                    ->description(fn ($record) => $record->description)
                    ->searchable()
                    ->limit(35),

                Tables\Columns\TextColumn::make('discount')
                    ->label('Discount')
                    ->state(fn ($record) => $record->discount_type === 'fixed' 
                        ? ('NGN ' . number_format($record->discount_amount ?? 0, 2)) 
                        : (($record->discount_percentage ?? 0) . '%')
                    )
                    ->badge()
                    ->color('success'),

                Tables\Columns\TextColumn::make('usage')
                    ->label('Usage')
                    ->state(fn ($record) => "{$record->times_used} / " . ($record->usage_limit ?: '∞'))
                    ->sortable(query: fn ($query, $direction) => $query->orderBy('times_used', $direction)),

                Tables\Columns\IconColumn::make('show_on_home')
                    ->label('Home Banner')
                    ->boolean()
                    ->trueIcon('heroicon-o-check-circle')
                    ->falseIcon('heroicon-o-x-circle')
                    ->trueColor('success')
                    ->falseColor('gray'),

                Tables\Columns\IconColumn::make('is_active')
                    ->label('Active')
                    ->boolean()
                    ->trueIcon('heroicon-o-check-circle')
                    ->falseIcon('heroicon-o-x-circle')
                    ->trueColor('success')
                    ->falseColor('danger'),

                Tables\Columns\TextColumn::make('valid_until')
                    ->label('Expires')
                    ->dateTime('M d, Y')
                    ->placeholder('Never')
                    ->sortable(),
            ])
            ->filters([
                Tables\Filters\TernaryFilter::make('is_active')
                    ->label('Active Status'),
                Tables\Filters\TernaryFilter::make('show_on_home')
                    ->label('Featured on Home'),
            ])
            ->actions([
                EditAction::make(),
                DeleteAction::make(),
            ])
            ->bulkActions([
                BulkActionGroup::make([
                    DeleteBulkAction::make(),
                ]),
            ]);
    }
}
