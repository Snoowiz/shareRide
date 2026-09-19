<?php

namespace App\Filament\Widgets;

use App\Models\Supabase\AvailableDriver;
use App\Models\Supabase\Delivery;
use App\Models\Supabase\DriverProfile;
use App\Models\Supabase\Profile;
use App\Models\Supabase\Ride;
use App\Models\Supabase\WithdrawalRequest;
use Filament\Widgets\StatsOverviewWidget as BaseWidget;
use Filament\Widgets\StatsOverviewWidget\Stat;

class PlatformOverview extends BaseWidget
{
    protected static ?int $sort = 1;
    protected int | string | array $columnSpan = 'full';
    protected ?string $pollingInterval = '30s';

    protected function getStats(): array
    {
        $data = cache()->remember('admin_platform_overview_stats', 30, function () {
            $activeRides = Ride::whereIn('status', ['searching', 'accepted', 'ongoing'])->count();
            $activeDeliveries = Delivery::whereIn('status', ['searching', 'accepted', 'picked_up', 'in_transit'])->count();
            $onlineDrivers = AvailableDriver::where('is_online', true)->count();
            $pendingVerifications = DriverProfile::where('verification_status', 'pending')->count();
            $pendingWithdrawals = WithdrawalRequest::where('status', 'pending')->count();
            $totalRiders = Profile::where('role', 'user')->count();
            $totalDrivers = Profile::where('role', 'driver')->count();

            $todayRevenue = Ride::where('status', 'completed')
                ->whereDate('updated_at', today())
                ->sum('commission_amount');
            $todayDeliveryRevenue = Delivery::where('status', 'delivered')
                ->whereDate('delivered_at', today())
                ->sum('commission_amount');

            return compact(
                'activeRides',
                'activeDeliveries',
                'onlineDrivers',
                'pendingVerifications',
                'pendingWithdrawals',
                'totalRiders',
                'totalDrivers',
                'todayRevenue',
                'todayDeliveryRevenue'
            );
        });

        extract($data);

        return [
            Stat::make('Active Rides', $activeRides)
                ->description('Currently in progress')
                ->icon('heroicon-o-map-pin')
                ->color('success'),

            Stat::make('Active Deliveries', $activeDeliveries)
                ->description('In transit')
                ->icon('heroicon-o-cube')
                ->color('info'),

            Stat::make('Online Drivers', $onlineDrivers)
                ->description('Available now')
                ->icon('heroicon-o-signal')
                ->color('success'),

            Stat::make('Pending Verifications', $pendingVerifications)
                ->description('Awaiting review')
                ->icon('heroicon-o-shield-check')
                ->color($pendingVerifications > 0 ? 'warning' : 'success'),

            Stat::make('Pending Withdrawals', $pendingWithdrawals)
                ->description('Need processing')
                ->icon('heroicon-o-banknotes')
                ->color($pendingWithdrawals > 0 ? 'warning' : 'success'),

            Stat::make('Today\'s Revenue', '₦' . number_format($todayRevenue + $todayDeliveryRevenue, 2))
                ->description('Commission earnings')
                ->icon('heroicon-o-currency-dollar')
                ->color('primary'),

            Stat::make('Total Riders', $totalRiders)
                ->icon('heroicon-o-user')
                ->color('info'),

            Stat::make('Total Drivers', $totalDrivers)
                ->icon('heroicon-o-truck')
                ->color('warning'),
        ];
    }
}
