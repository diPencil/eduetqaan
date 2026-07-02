import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { StatsService } from '../../core/services/stats.service';
import { OrderService } from '../../core/services/order.service';
import { DashboardStats } from '../../core/interfaces/stats.interface';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { SocketService } from '../../core/services/socket.service';
import { BaseChartDirective } from 'ng2-charts';
import { ChartDataResponse } from '../../core/models/analytics.model';
import { LiveRequestService, LiveRequest } from '../../core/services/live-request.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, IconComponent, BaseChartDirective],
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent {
  private statsService = inject(StatsService);
  private orderService = inject(OrderService);
  private socketService = inject(SocketService);
  
  stats = signal<DashboardStats['data'] | null>(null);
  revenueTrend = signal<ChartDataResponse | null>(null);
  studentGrowth = signal<ChartDataResponse | null>(null);
  isLoading = signal(true);
  error = signal<string | null>(null);

  // Live Sessions
  private liveRequestService = inject(LiveRequestService);
  upcomingSessions = signal<LiveRequest[]>([]);
  sessionAlerts = new Set<number>();
  showAlert = signal<LiveRequest | null>(null);
  alertAudio = new Audio('assets/sounds/notification.mp3'); // Optional sound

  // Filters
  currentGrade = signal<string | undefined>(undefined);
  selectedRange = signal<string>('this_month');

  // Privacy Mode
  isPrivate = signal(true);
  showPinModal = signal(false);
  enteredPin = signal('');
  pinError = signal(false);
  private PIN = '123';

  selectedReceipt: string | null = null;

  // Computed: Merge center data
  mergedCenterStats = computed(() => {
    const s = this.stats();
    if (!s) return [];

    const centers = s.centers?.studentsByCenter || [];
    const attendance = s.attendance?.attendanceByCenter || [];

    return centers.map(c => {
      const att = attendance.find(a => Number(a.centerId) === Number(c.centerId));
      const attendedCount = att?.uniqueStudents || 0;
      const totalStudents = c.studentsCount || 0;
      const attendancePercentage = totalStudents > 0 
        ? Math.round((attendedCount / totalStudents) * 100) 
        : 0;

      return {
        ...c,
        attendedCount,
        absenceCount: Math.max(0, totalStudents - attendedCount),
        attendancePercentage,
        avgExamScore: c.avgExamScore || 0,
        status: attendancePercentage > 75 ? 'ممتاز' : (attendancePercentage > 40 ? 'جيد' : 'يحتاج متابعة'),
        statusColor: attendancePercentage > 75 ? 'text-emerald-500' : (attendancePercentage > 40 ? 'text-amber-500' : 'text-red-500')
      };
    });
  });

  // Chart Options
  lineChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false }
    },
    scales: {
      y: { beginAtZero: true }
    }
  };

  doughnutChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom' as const }
    }
  };

  constructor() {
    this.loadStats();
    
    // Real-Time Dashboard Updates
    this.socketService.listen('dashboard_update').subscribe(() => {
      this.loadStats();
    });
    this.socketService.listen('new_payment').subscribe(() => {
      this.loadStats();
    });

    // Setup session alert checker
    setInterval(() => this.checkUpcomingSessions(), 60000);
    setTimeout(() => this.checkUpcomingSessions(), 5000); // Initial check after 5s
  }

  checkUpcomingSessions() {
    const now = new Date().getTime();
    const upcoming = this.upcomingSessions();
    for (const session of upcoming) {
      if (!session.scheduledAt) continue;
      const sessionTime = new Date(session.scheduledAt).getTime();
      const diffMinutes = (sessionTime - now) / 1000 / 60;
      
      // If within 15 minutes and not alerted yet
      if (diffMinutes <= 15 && diffMinutes > 0 && !this.sessionAlerts.has(session.id)) {
        this.sessionAlerts.add(session.id);
        this.showAlert.set(session);
        
        // Try to play sound (might be blocked by browser policy without interaction, but worth a try)
        this.alertAudio.play().catch(e => console.log('Audio play blocked:', e));

        // Auto dismiss after 30 seconds
        setTimeout(() => {
          if (this.showAlert()?.id === session.id) {
            this.showAlert.set(null);
          }
        }, 30000);
      }
    }
  }

  loadStats() {
    this.isLoading.set(true);
    this.error.set(null);
    
    let startDate: string | undefined;
    let endDate: string | undefined;
    
    const range = this.selectedRange();
    const now = new Date();
    
    if (range === 'this_week') {
      const start = new Date(now);
      start.setDate(now.getDate() - now.getDay());
      start.setHours(0, 0, 0, 0);
      startDate = start.toISOString();
    } else if (range === 'last_30_days') {
      const start = new Date(now);
      start.setDate(now.getDate() - 30);
      start.setHours(0, 0, 0, 0);
      startDate = start.toISOString();
    } else if (range === 'this_month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      startDate = start.toISOString();
    }

    this.statsService.getDashboardStats(this.currentGrade(), startDate, endDate).subscribe({
      next: (res) => {
        if (res.success) {
          this.stats.set(res.data);
        } else {
          this.error.set('فشل تحميل البيانات من السيرفر.');
        }
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Dashboard Stats Error:', err);
        this.error.set('حدث خطأ في الاتصال بالسيرفر.');
        this.isLoading.set(false);
      }
    });

    this.statsService.getRevenueTrend().subscribe(res => {
      if (res.success) {
        this.revenueTrend.set(res.data);
      }
    });

    this.statsService.getStudentGrowth().subscribe(res => {
      if (res.success) {
        this.studentGrowth.set(res.data);
      }
    });

    this.liveRequestService.getLiveRequests().subscribe(res => {
      if (res.success) {
        const now = new Date().getTime();
        const upcoming = res.data.filter(r => r.scheduledAt && new Date(r.scheduledAt).getTime() > now);
        upcoming.sort((a, b) => new Date(a.scheduledAt!).getTime() - new Date(b.scheduledAt!).getTime());
        this.upcomingSessions.set(upcoming);
      }
    });
  }

  onGradeChange(event: any) {
    const grade = event.target.value;
    this.currentGrade.set(grade === 'all' ? undefined : grade);
    this.loadStats();
  }

  onRangeChange(event: any) {
    this.selectedRange.set(event.target.value);
    this.loadStats();
  }

  togglePrivacy() {
    if (this.isPrivate()) {
      this.enteredPin.set('');
      this.pinError.set(false);
      this.showPinModal.set(true);
    } else {
      this.isPrivate.set(true);
    }
  }

  closePinModal() {
    this.showPinModal.set(false);
    this.enteredPin.set('');
    this.pinError.set(false);
  }

  handlePinInput(val: string) {
    if (this.enteredPin().length < 3) {
      this.enteredPin.update(p => p + val);
      if (this.enteredPin().length === 3) {
        this.submitPin();
      }
    }
  }

  backspacePin() {
    this.enteredPin.update(p => p.slice(0, -1));
    this.pinError.set(false);
  }

  submitPin() {
    if (this.enteredPin() === this.PIN) {
      this.isPrivate.set(false);
      this.closePinModal();
    } else {
      this.pinError.set(true);
      setTimeout(() => {
        this.enteredPin.set('');
        this.pinError.set(false);
      }, 1000);
    }
  }

  isSensitive(label: string): boolean {
    return label.includes('إيراد') || 
           label.includes('دفع') || 
           label.includes('محفظة') || 
           label.includes('كود') || 
           label.includes('أكواد');
  }

  getKpiRoute(label: string): string {
    if (label.includes('الطلاب')) return '/students';
    if (label.includes('إيراد') || label.includes('دفع')) return '/wallets';
    if (label.includes('كورسات')) return '/courses';
    if (label.includes('السناتر')) return '/centers';
    return '/dashboard';
  }

  getDateLabel(): string {
    const range = this.selectedRange();
    if (range === 'this_week') return 'هذا الأسبوع';
    if (range === 'last_30_days') return 'آخر 30 يوم';
    if (range === 'all_time') return 'كل الأوقات';
    return 'هذا الشهر';
  }

  getKpiIcon(label: string): string {
    if (label.includes('الطلاب')) return 'users';
    if (label.includes('إيراد') || label.includes('دفع')) return 'dollar-sign';
    if (label.includes('كورسات')) return 'book';
    if (label.includes('السناتر')) return 'building';
    if (label.includes('كود') || label.includes('أكواد')) return 'smartphone';
    return 'trending-up';
  }

  getActivityIcon(icon: string): string {
    if (icon.includes('user')) return 'user';
    if (icon.includes('credit') || icon.includes('dollar')) return 'dollar-sign';
    if (icon.includes('book')) return 'book';
    if (icon.includes('clipboard')) return 'clipboard-list';
    return 'bell';
  }

  onApproveRequest(ch: any) {
    if (!confirm(`هل أنت متأكد من الموافقة على طلب ${ch.studentName} بقيمة ${ch.amountCents / 100} ج.م؟`)) return;

    const sub = ch.type === 'TOPUP' 
      ? this.orderService.approveTopup(ch.id)
      : this.orderService.confirmManualOrder(ch.id);

    sub.subscribe(() => {
      this.loadStats();
    });
  }

  onRejectRequest(ch: any) {
    const reason = prompt('سبب الرفض (اختياري):');
    if (reason === null) return;

    const sub = ch.type === 'TOPUP'
      ? this.orderService.rejectTopup(ch.id, reason)
      : this.orderService.rejectManualOrder(ch.id);

    sub.subscribe(() => {
      this.loadStats();
    });
  }
}
