<?php

namespace App\Filament\Widgets;

use App\Models\Supabase\Ride;
use Filament\Widgets\ChartWidget;

class RideStatusChart extends ChartWidget
{
    protected ?string $heading = 'Rides by Status';
    protected static ?int $sort = 3;
    protected ?string $maxHeight = '250px';
    protected ?string $pollingInterval = '60s';

    protected function getData(): array
    {
        $statuses = ['completed', 'cancelled', 'searching', 'accepted', 'ongoing'];
        $colors = ['#10B981', '#EF4444', '#F59E0B', '#3B82F6', '#8B5CF6'];
        $fallback = [
            'datasets' => [
                [
                    'data' => array_fill(0, count($statuses), 0),
                    'backgroundColor' => $colors,
                ],
            ],
            'labels' => array_map('ucfirst', $statuses),
        ];

        try {
            return cache()->remember('admin_ride_status_chart_data', 60, function () use ($statuses, $colors, $fallback) {
                try {
                    $statusCounts = Ride::whereIn('status', $statuses)
                        ->selectRaw('status, count(*) as total')
                        ->groupBy('status')
                        ->pluck('total', 'status')
                        ->toArray();

                    $counts = array_map(fn($status) => $statusCounts[$status] ?? 0, $statuses);

                    return [
                        'datasets' => [
                            [
                                'data' => $counts,
                                'backgroundColor' => $colors,
                            ],
                        ],
                        'labels' => array_map('ucfirst', $statuses),
                    ];
                } catch (\Throwable $e) {
                    \Illuminate\Support\Facades\Log::warning('RideStatusChart query failed: ' . $e->getMessage());
                    return $fallback;
                }
            });
        } catch (\Throwable $e) {
            return $fallback;
        }
    }

    protected function getType(): string
    {
        return 'doughnut';
    }
}
