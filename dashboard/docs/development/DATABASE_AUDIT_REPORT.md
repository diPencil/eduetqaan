# Database Audit Report

## 1. Schema & Relations
- **Centralized Mapping**: The `stores.js` effectively centralizes the mapping between SQLite and MySQL models, and handles sync states.
- **Foreign Keys**: Relations are explicitly defined using Sequelize `belongsTo` and `hasMany`. 
- **Cascade Rules**:
  **ACTION ITEM**: Ensure critical tables (like `WalletTx` and `Wallet`) have `onDelete: 'RESTRICT'` or soft-deletes configured to prevent accidental financial data loss if a parent record is deleted.

## 2. Indexing Strategy
- Primary keys are inherently indexed.
- Columns frequently used in `where` clauses (e.g., `studentId` in `StudentAttendance`, `deviceId` in `DeviceSession`, `entityType` in `AuditLog`) appear to be queried heavily.
- **ACTION ITEM**: Add explicit composite indexes in the Sequelize model definitions for fields heavily queried together (e.g., `[studentId, deviceId]` in DeviceSessions).

## 3. Audit Logging
- The newly integrated `AuditLog` table securely isolates historical mutations from active tables. It effectively logs `action`, `entityType`, and `details`.
- **Data Retention**: 
  **ACTION ITEM**: Audit logs will grow exponentially. Implement a cron-job to archive or prune audit logs older than 1 year to maintain query speed on the main DB.

## Conclusion
**Status: READY WITH ACTION ITEMS**
The hybrid MySQL/SQLite sync architecture is highly ambitious and robust. Validating Cascade rules on financial records and adding strategic indexes are the final steps.
