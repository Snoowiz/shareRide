<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

class AdminSeeder extends Seeder
{
    public function run(): void
    {
        // Reset cached roles and permissions
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        // ── Create permissions ────────────────────────────────────────
        $permissions = [
            // Dashboard
            'view_dashboard',

            // Riders
            'view_riders', 'edit_riders', 'suspend_riders', 'credit_rider_wallet', 'debit_rider_wallet',

            // Drivers
            'view_drivers', 'edit_drivers', 'verify_drivers', 'suspend_drivers',

            // Rides & Deliveries
            'view_rides', 'view_deliveries', 'cancel_rides', 'cancel_deliveries',

            // Wallets & Finance
            'view_wallets', 'view_transactions', 'manage_withdrawals', 'process_payouts',

            // Support
            'view_support_tickets', 'reply_support_tickets', 'close_support_tickets',

            // Notifications
            'send_notifications', 'manage_broadcasts',

            // Settings
            'manage_settings', 'manage_commissions', 'manage_surge_zones',

            // Admin Management
            'manage_admins', 'view_audit_logs',
        ];

        foreach ($permissions as $permission) {
            Permission::firstOrCreate(['name' => $permission]);
        }

        // ── Create roles ─────────────────────────────────────────────
        $superAdmin = Role::firstOrCreate(['name' => 'super_admin']);
        $superAdmin->givePermissionTo(Permission::all());

        $moderator = Role::firstOrCreate(['name' => 'moderator']);
        $moderator->givePermissionTo([
            'view_dashboard',
            'view_riders', 'view_drivers', 'verify_drivers', 'suspend_drivers',
            'view_rides', 'view_deliveries',
            'view_wallets', 'view_transactions', 'manage_withdrawals',
            'view_support_tickets', 'reply_support_tickets', 'close_support_tickets',
        ]);

        // ── Create Super Admin user ──────────────────────────────────
        $admin = User::firstOrCreate(
            ['email' => 'dm.snoow@gmail.com'],
            [
                'name' => 'GoRide Admin',
                'password' => bcrypt('admin123'),
                'email_verified_at' => now(),
            ]
        );
        $admin->assignRole('super_admin');

        $this->command->info('✅ Admin account created: dm.snoow@gmail.com / admin123');
        $this->command->info('✅ Roles: super_admin, moderator');
        $this->command->info('✅ ' . count($permissions) . ' permissions configured');
    }
}
