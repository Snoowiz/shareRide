<?php

namespace App\Filament\Widgets;

use App\Models\Supabase\Ride;
use Filament\Widgets\ChartWidget;
use Illuminate\Support\Carbon;

class RevenueChart extends ChartWidget
{
    protected ?string $heading = 'Revenue (Last 7 Days)';
    protected static ?int $sort = 2;
    protected int | string | array $columnSpan = 'full';
    protected ?string $maxHeight = '300px';
    protected ?string $pollingInterval = '60s';

    protected function getData(): array
    {
        $days = collect(range(6, 0))->map(fn($i) => Carbon::today()->subDays($i));
        $labels = $days->map(fn($d) => $d->format('M d'))->toArray();
        $fallback = [
            'datasets' => [
                [
                    'label' => 'Ride Commission',
                    'data' => array_fill(0, 7, 0),
                    'borderColor' => '#0F346E',
                    'backgroundColor' => 'rgba(15, 52, 110, 0.1)',
                    'fill' => true,
                ],
                [
                    'label' => 'Delivery Commission',
                    'data' => array_fill(0, 7, 0),
                    'borderColor' => '#FCCA14',
                    'backgroundColor' => 'rgba(252, 202, 20, 0.1)',
                    'fill' => true,
                ],
            ],
            'labels' => $labels,
        ];

        try {
            return cache()->remember('admin_revenue_chart_data', 60, function () use ($days, $labels, $fallback) {
                try {
                    $startDate = Carbon::today()->subDays(6)->startOfDay();

                    $ridesByDay = Ride::where('status', 'completed')
                        ->where('updated_at', '>=', $startDate)
                        ->selectRaw("DATE(updated_at) as day_date, COALESCE(SUM(commission_amount), 0) as total")
                        ->groupByRaw("DATE(updated_at)")
                        ->pluck('total', 'day_date')
                        ->toArray();

                    $deliveriesByDay = \App\Models\Supabase\Delivery::where('status', 'delivered')
                        ->where('delivered_at', '>=', $startDate)
                        ->selectRaw("DATE(delivered_at) as day_date, COALESCE(SUM(commission_amount), 0) as total")
                        ->groupByRaw("DATE(delivered_at)")
                        ->pluck('total', 'day_date')
                        ->toArray();

                    $rideRevenue = [];
                    $deliveryRevenue = [];

                    foreach ($days as $day) {
                        $dateKey = $day->format('Y-m-d');
                        $rideRevenue[] = (float) ($ridesByDay[$dateKey] ?? 0);
                        $deliveryRevenue[] = (float) ($deliveriesByDay[$dateKey] ?? 0);
                    }

                    return [
                        'datasets' => [
                            [
                                'label' => 'Ride Commission',
                                'data' => $rideRevenue,
                                'borderColor' => '#0F346E',
                                'backgroundColor' => 'rgba(15, 52, 110, 0.1)',
                                'fill' => true,
                            ],
                            [
                                'label' => 'Delivery Commission',
                                'data' => $deliveryRevenue,
                                'borderColor' => '#FCCA14',
                                'backgroundColor' => 'rgba(252, 202, 20, 0.1)',
                                'fill' => true,
                            ],
                        ],
                        'labels' => $labels,
                    ];
                } catch (\Throwable $e) {
                    \Illuminate\Support\Facades\Log::warning('RevenueChart query failed: ' . $e->getMessage());
                    return $fallback;
                }
            });
        } catch (\Throwable $e) {
            return $fallback;
        }
    }

    protected function getType(): string
    {
        return 'line';
    }
}
