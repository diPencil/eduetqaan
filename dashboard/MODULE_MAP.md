# Module Map: Backend to Dashboard

This document maps backend API modules and entities to the corresponding admin dashboard screens and features.

## 1. Authentication & Security
- **Backend**: `users.routes.js`, `auth.routes.js`, `device-sessions.routes.js`
- **Dashboard Screens**:
  - Login Page
  - Admin Profile
  - User Management (Admins/Staff)
  - Device Session Management (Student active sessions)

## 2. Student Management
- **Backend**: `students.routes.js`, `student-activity.routes.js`, `student-insights.routes.js`, `progress.routes.js`
- **Dashboard Screens**:
  - Student Directory (List with total stats)
  - Student Details (Profile, Wallet, Enrollments, Progress)
  - Attendance Logs (QR scans, Session history)
  - Insights Dashboard (Engagement metrics)

## 3. Academic Content (LMS)
- **Backend**: `courses.routes.js`, `hls.routes.js`, `vdocipher.routes.js`
- **Dashboard Screens**:
  - Course Catalog (CRUD)
  - Lesson Editor (Video player integration, File uploads)
  - Category / Tag Management

## 4. Exams & Quizzes
- **Backend**: `admin.exams.routes.js`, `exams.routes.js`, `self-quiz.routes.js`
- **Dashboard Screens**:
  - Exam Builder (Question management, timing)
  - Question Bank
  - Results Tracker
  - Self-Quiz analytics

## 5. Financials & Vouchers
- **Backend**: `wallet.routes.js`, `vouchers.routes.js`, `admin.topups.routes.js`, `checkout.routes.js`
- **Dashboard Screens**:
  - Financial Overview (Revenue, Today's sales)
  - Order Management (Pending/Approved/Rejected)
  - Voucher Generator (Templates, Batch generation)
  - Manual Wallet Top-ups

## 6. Communications
- **Backend**: `notifications.routes.js`, `whatsapp.routes.js`
- **Dashboard Screens**:
  - Notification Center (Global/Targeted alerts)
  - WhatsApp Campaign Manager

## 7. Infrastructure
- **Backend**: `centers.routes.js`, `faq.routes.js`, `certificates.routes.js`
- **Dashboard Screens**:
  - Center Management (Locations, Branches)
  - FAQ Editor
  - Certificate Templates & Issuance
