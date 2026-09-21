<?php

namespace App\Filament\Resources\Supabase\ParcelTypes\Pages;

use App\Filament\Resources\Supabase\ParcelTypes\ParcelTypeResource;
use Filament\Actions\DeleteAction;
use Filament\Notifications\Notification;
use Filament\Resources\Pages\EditRecord;

class EditParcelType extends EditRecord
{
    protected static string $resource = ParcelTypeResource::class;

    protected function getHeaderActions(): array
    {
        return [
            DeleteAction::make()
                ->before(function (DeleteAction $action, $record) {
                    $count = $record->deliveries()->count();
                    if ($count > 0) {
                        Notification::make()
                            ->danger()
                            ->title('Cannot Delete Parcel Type')
                            ->body("This parcel category is referenced by {$count} delivery records in the database. Deactivate it instead of deleting to preserve historical data.")
                            ->persistent()
                            ->send();

                        $action->halt();
                    }
                }),
        ];
    }
}
