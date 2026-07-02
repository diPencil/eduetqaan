# Design System: Mohamed Samy Admin Dashboard

This document outlines the visual and interaction standards for the dashboard.

## 1. Typography
- **Primary Font**: `IBM Plex Sans Arabic` or `Cairo` (Google Fonts).
- **Secondary Font**: `Inter` (Standard for SaaS UI elements).
- **Scale**:
  - `h1`: 24px (Bold)
  - `h2`: 20px (Semi-bold)
  - `body`: 16px (Medium)
  - `caption`: 14px (Regular)

## 2. Color Palette
- **Primary**: `#0f172a` (Deep Slate for sidebar/nav).
- **Primary Contrast**: `#3b82f6` (Vibrant Blue for active items).
- **Success**: `#059669` (Emerald for completed/active).
- **Warning**: `#d97706` (Amber for pending/draft).
- **Danger**: `#dc2626` (Red for rejected/delete).
- **Background**: `#f8fafc` (Light gray for app body).
- **Surface**: `#ffffff` (White for cards/modals).

## 3. RTL & Localization
- **Layout**: `dir="rtl"` on `html` tag.
- **Alignment**:
  - Labels: Right-aligned.
  - Sidebar: Right-side fixed.
  - Buttons: Primary button on the left in footer actions.
- **Language**: 100% Arabic UI.

## 4. Component Standards
- **Tables**:
  - Striped rows for large datasets.
  - Hover effects for row highlighting.
  - Consistent column headers in Arabic.
- **Buttons**:
  - `variant="primary"`: Solid background.
  - `variant="outline"`: Transparent with border.
  - `variant="ghost"`: Text-only with hover.
- **Forms**:
  - Inline validation messages in Arabic.
  - Consistent border-radius (8px/0.5rem).
  - High focus contrast.
- **Feedback**:
  - `ngx-toastr` for global success/error messages.
  - Skeleton loaders for page transitions.

## 5. Spacing
- **Grid**: 4px/8px base (Standard Tailwind scale).
- **Page Margin**: 24px (L/R) for desktop.
- **Card Padding**: 16px or 20px.
