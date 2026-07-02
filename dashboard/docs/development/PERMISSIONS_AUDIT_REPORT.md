# Permissions Audit Report
Date: 2026-06-19

## Overview
This report documents the current state of Route Protections (Guards) and required roles across the dashboard architecture.

## Route Analysis

| Route | Required Role(s) | Current Protection | Status / Missing Protection |
|-------|------------------|--------------------|-----------------------------|
| `/dashboard` | All authenticated | `authGuard` | 🟡 Needs `roleGuard` (or explicit default) |
| `/students` | admin, supervisor | `authGuard` -> `roleGuard` | 🔴 Magic Strings used `['admin', 'supervisor']` |
| `/courses` | admin, supervisor, support | `authGuard` -> `roleGuard` | 🔴 Magic Strings used |
| `/exams` | admin, supervisor | `authGuard` -> `roleGuard` | 🔴 Magic Strings used |
| `/attendance` | admin, supervisor, center_manager | `authGuard` -> `roleGuard` | 🔴 Magic Strings used |
| `/games` | admin, supervisor | `authGuard` -> `roleGuard` | 🔴 Magic Strings used |
| `/wallets` | admin | `authGuard` -> `roleGuard` | 🔴 Magic Strings used |
| `/vouchers` | admin | `authGuard` -> `roleGuard` | 🔴 Magic Strings used |
| `/centers` | admin, supervisor, center_manager | `authGuard` -> `roleGuard` | 🔴 Magic Strings used |
| `/users` | admin | `authGuard` -> `roleGuard` | 🔴 Magic Strings used |
| `/audit-logs` | admin | `authGuard` -> `roleGuard` | 🟢 Newly added, strictly admin |

## Missing Protection / Security Risks
1. **Magic Strings in Routes:** The `data: { roles: ['admin'] }` pattern is highly error-prone. A typo in the string bypasses security.
2. **Missing Granular Permissions:** Currently, access is entirely Role-Based (RBAC). There is no Resource-Based or Action-Based protection (e.g., `canEditStudent`, `canDeleteWallet`).
3. **No Field-Level Protection:** If a `supervisor` views `/students`, they can see all data. There's no mechanism to hide sensitive fields (like parent phone numbers or billing history) from lower-tier roles.

## Recommendations for Remediation
1. Replace all magic strings with `Roles.ADMIN`, `Roles.SUPERVISOR` from the Enums created in Phase 2.
2. Implement a `PermissionGuard` alongside `RoleGuard` for granular actions.
