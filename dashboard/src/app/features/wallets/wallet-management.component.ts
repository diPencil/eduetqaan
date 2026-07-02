import { Component, inject, signal, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WalletService, WalletAdminStudent, WalletStats } from '../../core/services/wallet.service';
import { OrderService } from '../../core/services/order.service';
import { CenterService, Center } from '../../core/services/center.service';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { finalize } from 'rxjs';

interface PerfectNotification {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

@Component({
  selector: 'app-wallet-management',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent, RouterModule],
  templateUrl: './wallet-management.component.html',

  styles: [`
    ::-webkit-scrollbar { width: 6px; }
    ::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 10px; }
    ::-webkit-scrollbar-thumb:hover { background: rgba(0,0,0,0.2); }
    input[type=number]::-webkit-inner-spin-button, input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
    
    .custom-scrollbar::-webkit-scrollbar { width: 8px; }
    .custom-scrollbar::-webkit-scrollbar-thumb { background: #f1f5f9; border-radius: 20px; border: 2px solid white; }
    .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #e2e8f0; }
  `]
})
export class WalletManagementComponent implements OnInit {
  private walletService = inject(WalletService);
  private orderService = inject(OrderService);
  private centerService = inject(CenterService);

  activeTab = signal<'balances' | 'requests'>('balances');
  students = signal<WalletAdminStudent[]>([]);
  topups = signal<any[]>([]);
  centers = signal<Center[]>([]);
  stats = signal<WalletStats | null>(null);
  pagination = signal({ page: 1, totalPages: 1, total: 0 });
  isLoading = signal(false);
  
  // High Fidelity Notifications
  notifications = signal<PerfectNotification[]>([]);
  private notificationCounter = 0;

  // Filters
  searchQuery = '';
  selectedLevel = '';
  selectedCenterId: number | null = null;
  selectedRegion = '';
  hasBalance = false;
  
  // Top-up Filters
  topupStatusFilter = 'pending';
  selectedLevelReq = '';
  selectedCenterIdReq: number | null = null;
  selectedMethodReq = 'all';

  // Modal State
  selectedStudent = signal<WalletAdminStudent | null>(null);
  adjustType = signal<'add' | 'sub'>('add');
  adjustAmount: number | null = null;
  adjustNote = '';
  isAdjusting = signal(false);
  
  // Proof Viewer State
  selectedProof: string | null = null;
  proofRotation = signal(0);
  proofZoom = signal(1);

  // History Modal
  selectedHistoryStudent = signal<WalletAdminStudent | null>(null);
  studentTransactions = signal<any[]>([]);
  isLoadingHistory = signal(false);

  private searchTimeout: any;
  Math = Math;

  ngOnInit() {
    this.loadCenters();
    this.refreshAll();
  }

  showNotification(message: string, type: 'success' | 'error' | 'info' = 'success') {
    const id = ++this.notificationCounter;
    this.notifications.update(prev => [...prev, { id, message, type }]);
    setTimeout(() => this.removeNotification(id), 5000);
  }

  removeNotification(id: number) {
    this.notifications.update(prev => prev.filter(n => n.id !== id));
  }

  copyToClipboard(text: string, label: string = 'النص') {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      this.showNotification(`تم نسخ ${label} بنجاح!`, 'info');
    });
  }

  refreshAll() {
    this.loadStats();
    if (this.activeTab() === 'balances') {
      this.loadStudents();
    } else {
      this.loadTopups();
    }
  }

  loadCenters() {
    this.centerService.getCenters().subscribe(res => {
      if (res.success) this.centers.set(res.data);
    });
  }

  loadStats() {
    this.walletService.getStats().subscribe(res => {
      if (res.success) this.stats.set(res.data);
    });
  }

  loadStudents(page: number = 1) {
    this.isLoading.set(true);
    this.walletService.getAdminStudents({
      page: page,
      q: this.searchQuery || undefined,
      level: this.selectedLevel || undefined,
      centerId: this.selectedCenterId,
      region: this.selectedRegion || undefined,
      hasBalance: this.hasBalance,
      limit: 20
    }).pipe(finalize(() => this.isLoading.set(false)))
    .subscribe(res => {
      if (res.success) {
        this.students.set(res.data.students);
        this.pagination.set(res.data.pagination);
      }
    });
  }

  loadTopups() {
    this.isLoading.set(true);
    this.orderService.getTopups({
      status: this.topupStatusFilter,
      q: this.searchQuery || undefined,
      method: this.selectedMethodReq !== 'all' ? this.selectedMethodReq : undefined,
      level: this.selectedLevelReq || undefined,
      centerId: this.selectedCenterIdReq || undefined
    }).pipe(finalize(() => this.isLoading.set(false)))
    .subscribe(res => {
      let data = Array.isArray(res.data) ? res.data : (res.data as any)?.rows || [];
      const apiUrl = 'http://localhost:12011'; 

      data = data.map((t: any) => {
        let proof = t.proofImageUrl || t.proofUrl;
        if (proof && (proof.startsWith('https://api.your-domain.com') || proof.startsWith('/uploads'))) {
          const path = proof.replace('https://api.your-domain.com', '');
          proof = `${apiUrl}${path.startsWith('/') ? '' : '/'}${path}`;
        }

        return {
          ...t,
          studentName: t.studentName || t.student?.studentName || '—',
          studentPhone: t.studentPhone || t.student?.studentPhone || '—',
          proofImageUrl: proof
        };
      });

      this.topups.set(data);
    });
  }

  rotateProof() {
    this.proofRotation.update(prev => (prev + 90) % 360);
  }

  openHistoryModal(student: WalletAdminStudent) {
    this.selectedHistoryStudent.set(student);
    this.studentTransactions.set([]);
    this.loadStudentTransactions(student.id);
  }

  loadStudentTransactions(studentId: number) {
    this.isLoadingHistory.set(true);
    this.walletService.getStudentTransactions(studentId)
      .pipe(finalize(() => this.isLoadingHistory.set(false)))
      .subscribe(res => {
        if (res.success) {
          this.studentTransactions.set(res.data);
        }
      });
  }

  onSearchChange() {
    if (this.searchTimeout) clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => {
      if (this.activeTab() === 'balances') {
        this.loadStudents(1);
      } else {
        this.loadTopups();
      }
    }, 600);
  }

  resetFilters() {
    this.searchQuery = '';
    this.selectedLevel = '';
    this.selectedCenterId = null;
    this.selectedRegion = '';
    this.hasBalance = false;
    
    this.selectedLevelReq = '';
    this.selectedCenterIdReq = null;
    this.selectedMethodReq = 'all';
    this.topupStatusFilter = 'pending';

    this.showNotification('تمت إعادة ضبط جميع الفلاتر', 'info');
    this.refreshAll();
  }

  goToPage(page: number) {
    this.loadStudents(page);
  }

  openAdjustModal(student: WalletAdminStudent) {
    this.selectedStudent.set(student);
    this.adjustAmount = null;
    this.adjustNote = '';
    this.adjustType.set('add');
  }

  closeModal() {
    this.selectedStudent.set(null);
  }

  onAdjust() {
    const student = this.selectedStudent();
    if (!student || !this.adjustAmount || !this.adjustNote) return;
    this.isAdjusting.set(true);
    const amountCents = this.adjustType() === 'add' ? this.adjustAmount * 100 : -(this.adjustAmount * 100);
    this.walletService.adjustBalance(student.id, amountCents, this.adjustNote).subscribe({
      next: (res) => {
        if (res.success) {
          this.showNotification(`تم ${this.adjustType() === 'add' ? 'إضافة' : 'خصم'} ${this.adjustAmount} ج.م بنجاح`, 'success');
          this.closeModal();
          this.loadStudents(this.pagination().page);
          this.loadStats();
        } else {
          this.showNotification(res.message || 'فشلت العملية المالية', 'error');
        }
        this.isAdjusting.set(false);
      },
      error: () => {
        this.showNotification('حدث خطأ فني أثناء المعالجة', 'error');
        this.isAdjusting.set(false);
      }
    });
  }

  // Approve Modal State
  selectedTopupToApprove = signal<any>(null);
  isApproveModalOpen = signal(false);

  // Reject Modal State
  selectedTopupToReject = signal<any>(null);
  isRejectModalOpen = signal(false);
  rejectReason = signal('');

  approveTopup(topup: any) {
    this.selectedTopupToApprove.set(topup);
    this.isApproveModalOpen.set(true);
  }

  closeApproveModal() {
    this.isApproveModalOpen.set(false);
    this.selectedTopupToApprove.set(null);
  }

  confirmApproveTopup() {
    const topup = this.selectedTopupToApprove();
    if (!topup) return;

    this.isLoading.set(true);
    this.orderService.approveTopup(topup.id).pipe(finalize(() => this.isLoading.set(false)))
    .subscribe(res => {
      if (res.success) {
        this.showNotification('تمت الموافقة على طلب الشحن وتحديث رصيد الطالب', 'success');
        this.loadTopups();
        this.loadStats();
        this.closeApproveModal();
      } else {
        this.showNotification(res.message || 'فشلت الموافقة على الطلب', 'error');
      }
    });
  }

  rejectTopup(topup: any) {
    this.selectedTopupToReject.set(topup);
    this.rejectReason.set('');
    this.isRejectModalOpen.set(true);
  }

  closeRejectModal() {
    this.isRejectModalOpen.set(false);
    this.selectedTopupToReject.set(null);
    this.rejectReason.set('');
  }

  confirmRejectTopup() {
    const topup = this.selectedTopupToReject();
    const reason = this.rejectReason().trim();
    if (!topup) return;

    if (!reason) {
      this.showNotification('يجب إدخال سبب الرفض لإتمام العملية', 'error');
      return;
    }

    this.isLoading.set(true);
    this.orderService.rejectTopup(topup.id, reason).pipe(finalize(() => this.isLoading.set(false)))
    .subscribe(res => {
      if (res.success) {
        this.showNotification('تم رفض الطلب بنجاح وإرسال السبب للطالب', 'info');
        this.loadTopups();
        this.loadStats();
        this.closeRejectModal();
      } else {
        this.showNotification(res.message || 'فشل تنفيذ عملية الرفض', 'error');
      }
    });
  }
}
