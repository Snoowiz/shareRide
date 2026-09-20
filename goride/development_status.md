# GoRide Development Status & Feature Map

This document tracks the implementation status of the GoRide application features, distinguishing between live dynamic data (Supabase integrated) and mock UI components.

### **Role-Based Branding**
- **Rider (User)**: Primary: Navy Blue (#0F346E), Secondary: Yellow (#FCCA14).
- **Driver**: Primary: Yellow (#FCCA14), Secondary: Navy Blue (#0F346E).

## 🟢 Live / Dynamic Features (Implemented)
- **User Authentication**: Login, Sign-up, and Logout via Supabase.
- **Internationalized Auth**: Searchable country flags, auto-dial code detection, and input normalization.
- **Google OAuth**: Fully functional cross-platform Google Sign-In with deep-link redirection.
- **Unified Login**: Seamlessly handle both Phone and Email identities; smart account lookup via secure database RPCs.
- **Role Selection**: Dynamic role switching (Rider/Driver) with persistent state and animated transitions.
- **Real-time Ride Dispatch**: High-performance Supabase Realtime engine for instant ride broadcasting.
- **Rider-Driver Sync**: Real-time identity retrieval (names/avatars) and status-aware state transitions.
- **Proximity Filtering**: Intelligent ride filtering using Google Distance Matrix road-data (up to 6km).
- **User Profile**: Name, Greeting, and Profile Picture fetched from `AuthContext`.
- **Driver Dashboard UI**: Map integration with yellow-themed branding.
- **Theme Switching**: Light and Dark mode support across core screens with persistence.
- **Premium Feedback System**: Replaced native alerts with custom `AlertModal` featuring high-end Lottie animations for success and error feedback.
- **Driver Earnings & History**: Fully dynamic earnings dashboard and ride history integrated with Supabase `rides` and `deliveries` tables.
- **Dark Mode Map (Driver)**: Fully themed driver home screen with custom dark map geometry and adaptive UI components.
- **Notification System (Multi-Role)**: Full-stack real-time notification infrastructure:
  - **Database**: `notifications` and `push_tokens` tables with RLS policies. Automated Postgres triggers on `rides`, `deliveries`, `messages`, `wallet_transactions`, `withdrawal_requests`, and `profiles` tables to generate notification rows for ride/delivery status changes, new messages, wallet credits/debits, withdrawal status updates, and profile verifications.
  - **Push Delivery**: Supabase Edge Function (`send-push-notification`) triggered via `pg_net` webhook on every `notifications` INSERT, sends push via Expo Push API. Handles multi-device tokens, legacy token fallback, and automatic deactivation of invalid tokens.
  - **Client Context**: `NotificationProvider` wrapping the entire app provides global state (unread count, notification list), Supabase Realtime subscription for instant updates, push token registration on auth, foreground/background/killed-state notification handling, and intelligent deep-link routing via `expo-router`.
  - **UI Components**: Animated `NotificationBell` component with shake animation and live badge count on both rider and driver home screens. Dedicated notification history screens for both roles (`/(user)/notifications` and `/(driver)/notifications`) with role-branded headers, animated lists, mark-as-read, mark-all-read, delete, and clear-all actions.
  - **Supported Notification Types**: `ride_accepted`, `ride_arrived`, `ride_completed`, `ride_cancelled`, `delivery_accepted`, `delivery_picked_up`, `delivery_delivered`, `delivery_cancelled`, `message`, `wallet_credit`, `wallet_debit`, `withdrawal_approved`, `withdrawal_rejected`, `withdrawal_completed`, `profile_approved`, `profile_rejected`, `coupon`, `promo`, `system`, `admin_announcement`.
- **Premium Map & Real-time Tracking**: Implemented high-fidelity, theme-aware custom SVG vehicle icons (Car and Motorbike) using `expo-image`. Integrated full GPS `heading` synchronization via Supabase, enabling smooth real-time vehicle rotation on rider and sender maps.
- **Onboarding Experience**: Professional, persistent swipeable onboarding carousel with animated pagination, asset suites, and "Skip/Next" controls.
- **Support Chat & File Attachments**: Dynamic role-based topic selection, intelligent ticket linking to historical records, and robust file attachment functionality via Supabase storage.
- **Wallet & Financial Settlements**: Robust driver wallet system with fully synchronized payment verification (Paystack) and ride/delivery completion states between users. Secure withdrawal flows with pending-review states.
- **Profile UI Refinement**: Premium side-by-side layout for Rider and Driver profile headers, featuring dynamic verification checkmarks, stylized status badges, and refined responsive spacing.
- **Package Delivery (Rider)**: Full 7-step send-package flow connected to Supabase `deliveries` table. Auto-fills sender info from user profile, supports fare bidding, payer-dependent payment methods (sender=cash/wallet, receiver=cash), GPS-based current location for pickup, Realtime driver search with cancel support. 10-second auto-close timeout allows users to track searching requests in the background.
- **Package Delivery (Driver)**: Unified feed on driver home fetching from both `rides` and `deliveries` tables. Vehicle-type gating: motorbike=courier only, car/tricycle=rides+courier. Type badges (📦 DELIVERY / 🚗 RIDE) on request cards, bid price display, parcel info chips (type, weight, vehicle). Full `active-delivery.tsx` screen with 5-phase workflow (heading→arrived→picked_up→in_transit→delivered), GPS tracking, MapView with route directions, sender/receiver contact cards with call buttons, payment & bid info, progress tracker, and Supabase status updates at each phase transition.

## 🟡 Semi-Dynamic Features
- **Driver Verification**: Multi-step signup flow persists data to Supabase; `hasDriverProfile` gates dashboard access.

- **Coupons & Promo System**: Fully functional, dynamic coupon infrastructure connecting the Laravel/Filament Admin Panel with the Mobile App (Rider):
  - **Admin Panel**: Dedicated `Coupons` resource with percentage/fixed discount types, maximum discount cap, minimum ride fare requirement, usage limits, per-user limits, validity windows, and custom card/banner styling (custom background hex color, text color, and optional banner image).
  - **Database & Sync**: Real-time Supabase integration (`coupons` and `user_coupons` tables) with RLS security policies, usage tracking, and per-user redemption enforcement.
  - **Rider Home Screen**: Dynamic promo card banner synced in real time via Supabase channel, displaying custom admin styling, code badge, title, and description with 1-tap copy functionality and `AlertModal` confirmation.
  - **Checkout / Booking Flow**: Interactive "Apply Promo" feature in `book-ride.tsx` featuring an on-demand modal with manual promo code entry, available promo list selection, validation against active dates, minimum fare, and per-user limits, immediate fare recalculation, and automatic redemption logging upon ride creation.
- **Performance Graphs**: Distance and Average Hours charts.
- **Admin Notifications**: Coupon distribution, promo campaigns, and admin announcements (notification types exist, awaiting admin dashboard to trigger them).

## ⚙️ Planned Admin Controls
- **Acceptance Timeouts**: Admin-configurable window for drivers to accept rides before they expire.
- **Dispatch Radius**: Global setting to adjust the search radius between riders and available drivers (in meters/km).
- **Parcel Categories**: Dynamic parcel type list managed from admin dashboard (currently hardcoded in `PackageDeliveryContext`).
- **Driver Courier Mode**: Vehicle-type gating — bikes courier-only, cars both rides + courier.
- **Push Notification Management**: Admin panel to send broadcast notifications, manage notification templates, and monitor delivery stats.

---
*Last updated: 2026-05-16*
