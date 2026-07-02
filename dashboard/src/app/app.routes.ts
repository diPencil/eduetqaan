import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';

export const routes: Routes = [
  {
    path: 'auth',
    loadChildren: () => import('./features/auth/auth.routes').then(m => m.AUTH_ROUTES)
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/main-layout/main-layout.component').then(m => m.MainLayoutComponent),
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent)
      },
      {
        path: 'students',
        canActivate: [roleGuard],
        data: { roles: ['admin', 'supervisor'] },
        loadComponent: () => import('./features/students/student-list/student-list.component').then(m => m.StudentListComponent)
      },
      {
        path: 'students/:id',
        canActivate: [roleGuard],
        data: { roles: ['admin', 'supervisor'] },
        loadComponent: () => import('./features/students/student-details/student-details.component').then(m => m.StudentDetailsComponent)
      },
      {
        path: 'courses',
        canActivate: [roleGuard],
        data: { roles: ['admin', 'supervisor', 'support'] },
        loadComponent: () => import('./features/courses/course-list/course-list.component').then(m => m.CourseListComponent)
      },
      {
        path: 'exams',
        canActivate: [roleGuard],
        data: { roles: ['admin', 'supervisor'] },
        loadComponent: () => import('./features/exams/exam-list/exam-list.component').then(m => m.ExamListComponent)
      },
      {
        path: 'exams/question-bank',
        canActivate: [roleGuard],
        data: { roles: ['admin', 'supervisor'] },
        loadComponent: () => import('./features/exams/question-bank/question-bank.component').then(m => m.QuestionBankComponent)
      },
      {
        path: 'live-requests',
        canActivate: [roleGuard],
        data: { roles: ['admin', 'supervisor', 'support'] },
        loadComponent: () => import('./features/live-requests/live-request-list.component').then(m => m.LiveRequestListComponent)
      },
      {
        path: 'exams/center',
        canActivate: [roleGuard],
        data: { roles: ['admin', 'supervisor', 'center_manager'] },
        loadComponent: () => import('./features/exams/center-exams/center-exams.component').then(m => m.CenterExamsComponent)
      },
      {
        path: 'exams/:id/questions',
        canActivate: [roleGuard],
        data: { roles: ['admin', 'supervisor'] },
        loadComponent: () => import('./features/exams/exam-questions/exam-questions.component').then(m => m.ExamQuestionsComponent)
      },
      {
        path: 'exams/:id/report',
        canActivate: [roleGuard],
        data: { roles: ['admin', 'supervisor'] },
        loadComponent: () => import('./features/exams/exam-report/exam-report.component').then(m => m.ExamReportComponent)
      },
      {
        path: 'attendance',
        canActivate: [roleGuard],
        data: { roles: ['admin', 'supervisor', 'center_manager'] },
        loadComponent: () => import('./features/attendance/attendance-scanner/attendance-scanner.component').then(m => m.AttendanceScannerComponent)
      },

      {
        path: 'games',
        canActivate: [roleGuard],
        data: { roles: ['admin', 'supervisor'] },
        loadComponent: () => import('./features/games/game-list/game-list.component').then(m => m.GameListComponent)
      },
      {
        path: 'wallets',
        canActivate: [roleGuard],
        data: { roles: ['admin'] },
        loadComponent: () => import('./features/wallets/wallet-management.component').then(m => m.WalletManagementComponent)
      },
      {
        path: 'vouchers',
        canActivate: [roleGuard],
        data: { roles: ['admin'] },
        loadComponent: () => import('./features/vouchers/voucher-list/voucher-list.component').then(m => m.VoucherListComponent)
      },
      {
        path: 'centers',
        canActivate: [roleGuard],
        data: { roles: ['admin', 'supervisor', 'center_manager'] },
        loadComponent: () => import('./features/centers/center-list/center-list.component').then(m => m.CenterListComponent)
      },
      {
        path: 'qr-management',
        canActivate: [roleGuard],
        data: { roles: ['admin', 'supervisor'] },
        loadComponent: () => import('./features/qr-management/qr-management.component').then(m => m.QrManagementComponent)
      },
      {
        path: 'certificates',
        canActivate: [roleGuard],
        data: { roles: ['admin', 'supervisor'] },
        loadComponent: () => import('./features/certificates/certificate-management.component').then(m => m.CertificateManagementComponent)
      },
      {
        path: 'users',
        canActivate: [roleGuard],
        data: { roles: ['admin'] },
        loadComponent: () => import('./features/users/user-list/user-list.component').then(m => m.UserListComponent)
      },
      {
        path: 'audit-logs',
        canActivate: [roleGuard],
        data: { roles: ['admin'] },
        loadComponent: () => import('./features/audit-logs/audit-logs.component').then(m => m.AuditLogsComponent)
      },
      {
        path: 'whatsapp',
        canActivate: [roleGuard],
        data: { roles: ['admin', 'supervisor', 'support'] },
        loadComponent: () => import('./features/whatsapp/whatsapp-dashboard/whatsapp-dashboard.component').then(m => m.WhatsappDashboardComponent)
      },
      {
        path: 'notifications',
        canActivate: [roleGuard],
        data: { roles: ['admin', 'supervisor', 'support'] },
        loadComponent: () => import('./features/notifications/notification-manager/notification-manager.component').then(m => m.NotificationManagerComponent)
      },
      {
        path: 'plans',
        canActivate: [roleGuard],
        data: { roles: ['admin'] },
        loadComponent: () => import('./features/plans/plan-list/plan-list.component').then(m => m.PlanListComponent)
      },
      {
        path: 'subscriptions',
        canActivate: [roleGuard],
        data: { roles: ['admin'] },
        loadComponent: () => import('./features/subscriptions/subscription-list/subscription-list.component').then(m => m.SubscriptionListComponent)
      },
      {
        path: 'self-quiz',
        canActivate: [roleGuard],
        data: { roles: ['admin', 'supervisor', 'support'] },
        loadComponent: () => import('./features/self-quiz/chapter-list/chapter-list.component').then(m => m.ChapterListComponent)
      },
      {
        path: 'self-quiz/:id',
        canActivate: [roleGuard],
        data: { roles: ['admin', 'supervisor', 'support'] },
        loadComponent: () => import('./features/self-quiz/chapter-details/chapter-details.component').then(m => m.ChapterDetailsComponent)
      },
      {
        path: 'community',
        canActivate: [roleGuard],
        data: { roles: ['admin', 'supervisor', 'support'] },
        loadComponent: () => import('./features/community/question-list/question-list.component').then(m => m.QuestionListComponent)
      },
      {
        path: 'community/:id',
        canActivate: [roleGuard],
        data: { roles: ['admin', 'supervisor', 'support'] },
        loadComponent: () => import('./features/community/question-thread/question-thread.component').then(m => m.QuestionThreadComponent)
      },
      {
        path: 'cms/faq',
        canActivate: [roleGuard],
        data: { roles: ['admin', 'supervisor', 'support'] },
        loadComponent: () => import('./features/cms/faq-management.component').then(m => m.FaqManagementComponent)
      },
      {
        path: 'cms/maps',
        canActivate: [roleGuard],
        data: { roles: ['admin', 'supervisor', 'support'] },
        loadComponent: () => import('./features/cms/map-management/map-list.component').then(m => m.MapListComponent)
      },
      {
        path: 'cms/maps/:id',
        canActivate: [roleGuard],
        data: { roles: ['admin', 'supervisor', 'support'] },
        loadComponent: () => import('./features/cms/map-management/map-editor.component').then(m => m.MapEditorComponent)
      },
      {
        path: 'sync-center',
        canActivate: [roleGuard],
        data: { roles: ['admin', 'supervisor'] },
        loadComponent: () => import('./features/sync-center/sync-center.component').then(m => m.SyncCenterComponent)
      },
      {
        path: 'gamification',
        canActivate: [roleGuard],
        data: { roles: ['admin'] },
        loadComponent: () => import('./features/gamification/gamification.component').then(m => m.GamificationComponent)
      },
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full'
      }
    ]
  },
  {
    path: '**',
    redirectTo: 'dashboard'
  }
];
