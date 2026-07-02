export enum Status {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected'
}

export const STATUS_LABELS: Record<Status, string> = {
  [Status.ACTIVE]: 'نشط',
  [Status.INACTIVE]: 'غير نشط',
  [Status.PENDING]: 'قيد الانتظار',
  [Status.APPROVED]: 'موافق عليه',
  [Status.REJECTED]: 'مرفوض'
};
