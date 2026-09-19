# GoRide — Full-Stack Ride Sharing & Delivery Platform

A complete, production-grade ride-hailing and parcel delivery platform with a mobile application and administrative management panel.

---

## 📁 Monorepo Structure

```
.
├── admin-web/     # GoRide Admin Panel (Laravel 12 + Filament v3 + MySQL & Supabase)
└── goride/        # GoRide Mobile App (React Native + Expo SDK 52 + Supabase)
```

---

## 📱 1. GoRide Mobile App (`/goride`)

Unified Rider & Driver application built with **React Native**, **Expo**, and **Supabase Realtime**.

### Features:
- **Ride Hailing**: Real-time driver matching, Google Maps routing, dynamic polyline tracking, fare calculation.
- **Package Delivery**: Parcel booking with sender/recipient contact, vehicle selection (car, motorbike), step-by-step progress tracking.
- **Driver Mode**: Online/offline toggle, ride requests with acceptance countdown, trip navigation, wallet top-up, withdrawal requests.
- **Wallet & Payments**: Paystack integration, driver commissions, user wallet balance, transaction ledger.
- **Role Theming**: Adaptive color scheme for Rider (Navy Blue `#0F346E`) and Driver (Yellow Gold `#FCCA14`) with dark/light mode support.

### Setup:
```bash
cd goride
npm install
cp .env.example .env
# Fill in your Google Maps API Key, Supabase URL/Anon Key, and Paystack Key
npx expo start
```

---

## 💻 2. GoRide Admin Panel (`/admin-web`)

Comprehensive management panel built with **Laravel 12**, **Filament v3**, **Spatie Permissions**, and dual database architecture.

### Features:
- **Operations Dashboard**: Live ride and parcel delivery monitoring, status badges, customer and driver details.
- **Driver Verification**: Document review and approval workflow (pending, approved, rejected).
- **Financial Controls**: Withdrawal request approvals, wallet transaction auditing, platform commission tracking.
- **Support System**: Live ticket management and resolution.
- **Role-Based Access Control**: Super Admin and Moderator roles with granular permission levels.

### Setup:
```bash
cd admin-web
composer install
npm install && npm run build
cp .env.example .env
# Configure MySQL database and Supabase connection pooler
php artisan key:generate
php artisan migrate
php artisan db:seed --class=AdminSeeder
php artisan serve
```
