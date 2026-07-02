import { Injectable, signal } from '@angular/core';

export type UserRole = 'admin' | 'supervisor' | 'center_manager' | 'support' | 'student';

export interface NavItem {
  label: string;
  route: string;
  icon: string;
  allowedRoles?: UserRole[];
}

export interface NavGroup {
  groupName: string;
  items: NavItem[];
}

@Injectable({
  providedIn: 'root'
})
export class NavService {
  private isOpen = signal(false);

  readonly navGroups: NavGroup[] = [
    {
      groupName: 'نظرة عامة',
      items: [
        { label: 'الرئيسية', route: '/dashboard', icon: 'home' },
        { label: 'الإشعارات', route: '/notifications', icon: 'bell', allowedRoles: ['admin', 'supervisor', 'support'] },
      ]
    },
    {
      groupName: 'الشؤون التعليمية',
      items: [
        { label: 'الطلاب', route: '/students', icon: 'users', allowedRoles: ['admin', 'supervisor'] },
        { label: 'الدورات الدراسية', route: '/courses', icon: 'book', allowedRoles: ['admin', 'supervisor', 'support'] },
        { label: 'الاختبارات', route: '/exams', icon: 'clipboard-list', allowedRoles: ['admin', 'supervisor'] },
        { label: 'بنك الأسئلة الشامل', route: '/exams/question-bank', icon: 'database', allowedRoles: ['admin', 'supervisor'] },
        { label: 'بنك أسئلة المذاكرة', route: '/self-quiz', icon: 'book-open', allowedRoles: ['admin', 'supervisor'] },
        { label: 'إدارة أكواد الـ QR', route: '/qr-management', icon: 'qr-code', allowedRoles: ['admin', 'supervisor'] },
        { label: 'إدارة الشهادات', route: '/certificates', icon: 'award', allowedRoles: ['admin', 'supervisor'] },
      ]
    },
    {
      groupName: 'إدارة السناتر والحضور',
      items: [
        { label: 'السناتر', route: '/centers', icon: 'building', allowedRoles: ['admin', 'supervisor', 'center_manager'] },
        { label: 'الحضور والغياب', route: '/attendance', icon: 'clock', allowedRoles: ['admin', 'supervisor', 'center_manager'] },
        { label: 'إدارة امتحانات السنتر', route: '/exams/center', icon: 'bar-chart-2', allowedRoles: ['admin', 'supervisor', 'center_manager'] },
      ]
    },
    {
      groupName: 'المالية والاشتراكات',
      items: [
        { label: 'إدارة محافظ الطلاب', route: '/wallets', icon: 'wallet', allowedRoles: ['admin'] },
        { label: 'الاشتراكات الفعالة', route: '/subscriptions', icon: 'ticket', allowedRoles: ['admin'] },
        { label: 'كروت الشحن', route: '/vouchers', icon: 'gift', allowedRoles: ['admin'] },
        { label: 'الباقات والمخططات', route: '/plans', icon: 'diamond', allowedRoles: ['admin'] },
      ]
    },
    {
      groupName: 'التواصل والتفاعل',
      items: [
        { label: 'واتساب', route: '/whatsapp', icon: 'message-square', allowedRoles: ['admin', 'supervisor', 'support'] },
        { label: 'طلبات المواعيد (Live)', route: '/live-requests', icon: 'calendar-check', allowedRoles: ['admin', 'supervisor', 'support'] },
        { label: 'مستشار الطلاب (Q&A)', route: '/community', icon: 'help-circle', allowedRoles: ['admin', 'supervisor', 'support'] },
        { label: 'الألعاب والمسابقات', route: '/games', icon: 'gamepad-2', allowedRoles: ['admin', 'supervisor'] },
        { label: 'نظام المكافآت والنقاط', route: '/gamification', icon: 'trophy', allowedRoles: ['admin'] },
      ]
    },
    {
      groupName: 'إدارة المحتوى (CMS)',
      items: [
        { label: 'الأسئلة الشائعة (FAQ)', route: '/cms/faq', icon: 'help-circle', allowedRoles: ['admin', 'supervisor', 'support'] },
        { label: 'خرائط المراجعة', route: '/cms/maps', icon: 'map', allowedRoles: ['admin', 'supervisor', 'support'] },
      ]
    },
    {
      groupName: 'النظام',
      items: [
        { label: 'إدارة المديرين', route: '/users', icon: 'shield', allowedRoles: ['admin'] },
        { label: 'مركز المزامنة', route: '/sync-center', icon: 'sync', allowedRoles: ['admin', 'supervisor'] }
      ]
    }
  ];

  get isSidebarOpen() {
    return this.isOpen.asReadonly();
  }

  toggleSidebar() {
    this.isOpen.update(val => !val);
  }

  closeSidebar() {
    this.isOpen.set(false);
  }

  openSidebar() {
    this.isOpen.set(true);
  }
}
