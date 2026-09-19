<div x-data="{ open: false }" class="mt-2">
    @php
        $url = $getState();
        if ($url && !str_starts_with($url, 'http') && !str_starts_with($url, 'data:')) {
            $storageUrl = str_starts_with($url, '/storage/') ? $url : \Illuminate\Support\Facades\Storage::url($url);
            $url = asset($storageUrl);
        }
    @endphp
    @if($url)
        <!-- Thumbnail -->
        <img 
            @click="open = true" 
            src="{{ $url }}" 
            class="h-32 w-auto rounded-lg shadow-sm cursor-pointer border border-gray-200 dark:border-gray-700 hover:opacity-80 transition-opacity" 
            alt="Attachment Preview" 
        />

        <!-- Fullscreen Modal -->
        <div 
            x-show="open" 
            x-cloak
            class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
            x-transition:enter="transition ease-out duration-300"
            x-transition:enter-start="opacity-0"
            x-transition:enter-end="opacity-100"
            x-transition:leave="transition ease-in duration-200"
            x-transition:leave-start="opacity-100"
            x-transition:leave-end="opacity-0"
        >
            <!-- Close Button -->
            <button 
                @click="open = false" 
                class="absolute top-6 right-6 text-white bg-black/50 hover:bg-red-600 rounded-full p-2 transition-colors focus:outline-none"
            >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>

            <!-- Expanded Image -->
            <img 
                @click.away="open = false" 
                src="{{ $url }}" 
                class="max-w-[90vw] max-h-[90vh] rounded-lg shadow-2xl" 
                alt="Full Attachment" 
            />
        </div>
    @endif
</div>
