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
        return cache()->remember('admin_ride_status_chart_data', 60, function () {
            $statuses = ['completed', 'cancelled', 'searching', 'accepted', 'ongoing'];
            $colors = ['#10B981', '#EF4444', '#F59E0B', '#3B82F6', '#8B5CF6'];

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
        });
    }

    protected function getType(): string
    {
        return 'doughnut';
    }
}
