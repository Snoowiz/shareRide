<?php

namespace App\Filament\Resources\SupportTicketResource\Widgets;

use Filament\Widgets\Widget;
use Filament\Forms\Contracts\HasForms;
use Illuminate\Support\Facades\Storage;
use Filament\Forms\Concerns\InteractsWithForms;
use Filament\Schemas\Schema;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\FileUpload;
use App\Models\Supabase\SupportMessage;
use App\Models\Supabase\SupportTicket;
use Filament\Notifications\Notification;

class TicketReplyWidget extends Widget implements HasForms
{
    use InteractsWithForms;

    protected string $view = 'filament.resources.support-ticket.widgets.ticket-reply-widget';

    protected int | string | array $columnSpan = 'full';

    public ?SupportTicket $record = null;

    public ?array $data = [];

    public function mount(SupportTicket $record): void
    {
        $this->record = $record;
        $this->form->fill();
    }

    public function form(Schema $schema): Schema
    {
        return $schema
            ->schema([
                Textarea::make('message')
                    ->label('Reply Message')
                    ->required()
                    ->rows(3),
                FileUpload::make('attachment_url')
                    ->label('Attach Image/Document')
                    ->image()
                    ->directory('support_attachments')
                    ->maxSize(5120),
            ])
            ->statePath('data');
    }

    public function submit(): void
    {
        $state = $this->form->getState();

        $attachmentUrl = null;
        if (!empty($state['attachment_url'])) {
            $path = $state['attachment_url'];
            
            if (str_starts_with($path, 'http')) {
                $attachmentUrl = $path;
            } else {
                $supabaseUrl = env('SUPABASE_URL');
                $supabaseAnonKey = env('SUPABASE_ANON_KEY');
                
                // Find where the file is stored locally temporarily
                $fullPath = storage_path('app/public/' . $path);
                if (!file_exists($fullPath)) {
                    $fullPath = storage_path('app/' . $path);
                }

                if (file_exists($fullPath) && $supabaseUrl && $supabaseAnonKey) {
                    $bucket = 'support_attachments';
                    $fileName = basename($path);
                    $fileContent = file_get_contents($fullPath);
                    $ext = pathinfo($fileName, PATHINFO_EXTENSION);
                    
                    $contentType = match($ext) {
                        'jpg', 'jpeg' => 'image/jpeg',
                        'png' => 'image/png',
                        'gif' => 'image/gif',
                        'webp' => 'image/webp',
                        'pdf' => 'application/pdf',
                        default => 'application/octet-stream'
                    };

                    // Upload to Supabase Storage
                    $response = \Illuminate\Support\Facades\Http::withHeaders([
                        'Authorization' => 'Bearer ' . $supabaseAnonKey,
                        'apikey' => $supabaseAnonKey,
                        'Content-Type' => $contentType,
                    ])->withBody($fileContent, $contentType)
                      ->post($supabaseUrl . '/storage/v1/object/' . $bucket . '/' . $fileName);

                    if ($response->successful()) {
                        // Success! Use the public Supabase URL
                        $attachmentUrl = $supabaseUrl . '/storage/v1/object/public/' . $bucket . '/' . $fileName;
                        @unlink($fullPath); // Delete local temp file
                    } else {
                        // Fallback to local URL if Supabase fails
                        $storageUrl = str_starts_with($path, '/storage/') ? $path : Storage::url($path);
                        $attachmentUrl = asset($storageUrl);
                    }
                } else {
                    $storageUrl = str_starts_with($path, '/storage/') ? $path : Storage::url($path);
                    $attachmentUrl = asset($storageUrl);
                }
            }
        }

        SupportMessage::create([
            'ticket_id' => $this->record->id,
            'sender_id' => null, // Admin
            'message' => '[Admin] ' . $state['message'],
            'attachment_url' => $attachmentUrl,
        ]);

        if ($this->record->user_id) {
            \App\Models\Supabase\Notification::create([
                'user_id' => $this->record->user_id,
                'type' => 'support_reply',
                'title' => 'Support Reply',
                'body' => 'You have a new reply on your support ticket.',
                'data' => json_encode(['screen' => 'support_chat', 'ticket_id' => $this->record->id]),
            ]);

            // Dispatch transactional email to user
            $userProfile = $this->record->user;
            if ($userProfile && !empty($userProfile->email)) {
                \App\Services\NotificationService::sendComplaintReply(
                    email: $userProfile->email,
                    name: $userProfile->full_name ?: 'Valued User',
                    ticketData: [
                        'id' => $this->record->id,
                        'subject' => $this->record->subject,
                    ],
                    replyMessage: $state['message'],
                    status: $this->record->status ?? 'In Progress'
                );
            }
        }

        Notification::make()->title('Reply sent successfully!')->success()->send();
        
        $this->form->fill();
        
        $this->redirect(request()->header('Referer'));
    }
}
