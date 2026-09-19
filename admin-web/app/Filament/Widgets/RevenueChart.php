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
        return cache()->remember('admin_revenue_chart_data', 60, function () {
            $startDate = Carbon::today()->subDays(6)->startOfDay();
            $days = collect(range(6, 0))->map(fn($i) => Carbon::today()->subDays($i));

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
            $labels = [];

            foreach ($days as $day) {
                $dateKey = $day->format('Y-m-d');
                $labels[] = $day->format('M d');
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
        });
    }

    protected function getType(): string
    {
        return 'line';
    }
}
