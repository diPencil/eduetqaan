import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { StudentService, Student } from '../../../core/services/student.service';
import { CourseService } from '../../../core/services/course.service';
import { WhatsappService } from '../../../core/services/whatsapp.service';
import { AuditService } from '../../../core/services/audit.service';
import { AuditAction, AuditEntityType } from '../../../core/models/audit.model';
import { finalize } from 'rxjs';
import { ModalService } from '../../../shared/components/modal/modal.service';

@Component({
  selector: 'app-student-details',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './student-details.component.html',
})
export class StudentDetailsComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private studentService = inject(StudentService);
  private courseService = inject(CourseService);
  private whatsappService = inject(WhatsappService);
  private auditService = inject(AuditService);
  private modalService = inject(ModalService);

  studentId = 0;
  activeTab = signal('profile');
  student = signal<Student | null>(null);
  balance = signal(0);
  transactions = signal<any[]>([]);
  totalRecharge = signal(0);
  totalConsumption = signal(0);
  enrollments = signal<any[]>([]);
  devices = signal<any[]>([]);
  attendances = signal<any[]>([]);
  manualOverrides = signal<any[]>([]);
  attendanceOverrides = signal<any[]>([]);
  courses = signal<any[]>([]);
  performanceStats = signal<any>(null);
  allLessons = signal<any[]>([]);

  // Gamification
  pointsHistory = signal<any[]>([]);
  showPointsModal = signal(false);
  showPointsLogModal = signal(false);
  pointsForm = { points: 0, reason: '' };

  // Premium Feedback & Modals
  statusModal = signal(false);
  statusMessage = signal('');
  statusType = signal<'success' | 'error'>('success');

  isSaving = signal(false);
  isEditing = signal(false);
  showChargeModal = signal(false);
  showEnrollModal = signal(false);
  showOverrideModal = signal(false);
  showExtendModal = signal(false);

  studentForm: any = {};
  chargeForm = { amount: 0, desc: '' };
  enrollForm = { courseId: null as number | null };
  overrideForm = { lessonId: null as number | null, expiresAt: '', allowVideoAccess: true, allowHomeworkAccess: true, maxViews: 3, note: '' };
  extendForm = { attendanceId: 0, expiresAt: '', lessonTitle: '' };

  // WhatsApp
  isWaModalOpen = signal(false);
  waMessage = '';

  showStatus(msg: string, type: 'success' | 'error' = 'success') {
    this.statusMessage.set(msg);
    this.statusType.set(type);
    this.statusModal.set(true);
    setTimeout(() => this.statusModal.set(false), 3000);
  }

  ngOnInit() {
    this.studentId = Number(this.route.snapshot.paramMap.get('id'));
    if (this.studentId) {
      this.loadAllData();
    }
  }

  loadAllData() {
    this.studentService.getStudent(this.studentId).subscribe(res => {
      this.student.set(res.data);
    });

    this.studentService.getStudentWallet(this.studentId).subscribe(res => {
      if (res?.success && res?.data?.wallet) {
        this.balance.set((res.data.wallet.balanceCents || 0) / 100);
        this.transactions.set(res.data.recent || []);
      }
    });

    this.studentService.getStudentWalletTransactions(this.studentId).subscribe(res => {
      if (res?.success && res?.data) {
        let recharge = 0;
        let consumption = 0;
        res.data.forEach((tx: any) => {
          if (tx.amountCents > 0) {
            recharge += tx.amountCents;
          } else {
            consumption += Math.abs(tx.amountCents);
          }
        });
        this.totalRecharge.set(recharge / 100);
        this.totalConsumption.set(consumption / 100);
      }
    });

    this.studentService.getEnrollments(this.studentId).subscribe(res => {
      if (res?.success) {
        this.enrollments.set(res.data || []);
      }
    });

    this.studentService.getDevices(this.studentId).subscribe(res => {
      if (res?.success) {
        this.devices.set(res.data || []);
      }
    });

    this.studentService.getStudentPerformance(this.studentId).subscribe(res => {
      if (res?.success) {
        this.performanceStats.set(res.data);
      }
    });

    this.loadAttendance();
    this.loadOverrides();
    this.loadAllLessons();
    this.loadPointsHistory();
  }

  loadPointsHistory() {
    this.studentService.getStudentPoints(this.studentId).subscribe(res => {
      if (res?.success) {
        this.pointsHistory.set(res.data || []);
      }
    });
  }

  loadAttendance() {
    this.studentService.getStudentAttendance(this.studentId).subscribe(res => {
      if (res?.success) {
        this.attendances.set(res.data || []);
      }
    });
  }

  loadOverrides() {
    this.studentService.getOverrides(this.studentId).subscribe(res => {
      if (res?.success) {
        this.manualOverrides.set(res.data?.manual || []);
        this.attendanceOverrides.set(res.data?.attendance || []);
      }
    });
  }

  loadAllLessons() {
    this.courseService.getCourses().subscribe(coursesRes => {
       if (coursesRes?.success) {
          const all: any[] = [];
          coursesRes.data.forEach((c: any) => {
             this.courseService.getCourse(c.id).subscribe(details => {
                if (details?.data?.lessons) {
                   details.data.lessons.forEach((l: any) => {
                      all.push({ ...l, courseTitle: c.title });
                   });
                   this.allLessons.set([...all]);
                }
             });
          });
       }
    });
  }

  openEditModal() {
    const s = this.student();
    if (!s) return;
    this.studentForm = { ...s };
    this.isEditing.set(true);
  }

  closeEditModal() {
    this.isEditing.set(false);
  }

  onSaveStudent() {
    this.isSaving.set(true);
    const cleanData = {
      studentName: this.studentForm.studentName,
      email: this.studentForm.email,
      studentPhone: this.studentForm.studentPhone,
      guardianPhone: this.studentForm.guardianPhone,
      year: this.studentForm.year,
      region: this.studentForm.region,
      centerCode: this.studentForm.centerCode,
      centerId: this.studentForm.centerId || null
    };

    this.studentService.updateStudent(this.studentId, cleanData).subscribe({
      next: () => {
        this.loadAllData();
        this.closeEditModal();
        this.isSaving.set(false);
        this.showStatus('تم تحديث البيانات بنجاح ✅', 'success');
      },
      error: (err) => {
        this.isSaving.set(false);
        this.showStatus(err.error?.message || 'فشل التحديث', 'error');
      }
    });
  }

  // Gamification Actions
  openPointsModal() {
    this.pointsForm = { points: 0, reason: '' };
    this.showPointsModal.set(true);
  }

  closePointsModal() {
    this.showPointsModal.set(false);
  }

  openPointsLogModal() {
    this.showPointsLogModal.set(true);
  }

  closePointsLogModal() {
    this.showPointsLogModal.set(false);
  }

  submitPoints() {
    if (!this.pointsForm.points || !this.pointsForm.reason) {
      this.showStatus('الرجاء إدخال النقاط والسبب', 'error');
      return;
    }
    
    this.isSaving.set(true);
    this.studentService.adjustStudentPoints(this.studentId, this.pointsForm.points, this.pointsForm.reason).subscribe({
      next: (res) => {
        if (res.success) {
          this.showStatus('تم تحديث النقاط بنجاح', 'success');
          // Update total points in UI manually instead of full reload
          const s = this.student();
          if (s) {
            this.student.set({ ...s, totalPoints: res.data.totalPoints });
          }
          this.loadPointsHistory();
          this.closePointsModal();
        }
        this.isSaving.set(false);
      },
      error: (err) => {
        this.showStatus(err.error?.message || 'فشل تحديث النقاط', 'error');
        this.isSaving.set(false);
      }
    });
  }

  openChargeModal() {
    this.chargeForm = { amount: 0, desc: '' };
    this.showChargeModal.set(true);
  }

  onConfirmCharge() {
    if (this.chargeForm.amount <= 0) return;
    this.isSaving.set(true);
    // Convert to cents
    this.studentService.adjustWallet(this.studentId, this.chargeForm.amount * 100, this.chargeForm.desc).subscribe({
      next: () => {
        this.auditService.logPaymentAction(this.studentId, this.chargeForm.amount, this.chargeForm.desc);
        this.loadAllData();
        this.showChargeModal.set(false);
        this.isSaving.set(false);
      },
      error: () => this.isSaving.set(false)
    });
  }

  openEnrollModal() {
    this.enrollForm = { courseId: null };
    this.courseService.getCourses().subscribe(res => {
      this.courses.set(res.data);
      this.showEnrollModal.set(true);
    });
  }

  onConfirmEnroll() {
    if (!this.enrollForm.courseId) return;
    this.isSaving.set(true);
    this.studentService.manualEnroll(this.studentId, this.enrollForm.courseId).subscribe({
      next: () => {
        this.auditService.logSubscriptionAction(this.studentId, this.enrollForm.courseId!, 'Manual Enrollment');
        this.loadAllData();
        this.showEnrollModal.set(false);
        this.isSaving.set(false);
      },
      error: () => this.isSaving.set(false)
    });
  }

  onRevokeDevice(id: number) {
    this.modalService.confirm({
      title: 'إلغاء الجلسة',
      message: 'هل أنت متأكد من إلغاء جلسة هذا الجهاز؟ سيتم تسجيل خروج الطالب فوراً.',
      confirmType: 'danger',
      onConfirm: () => {
        this.studentService.revokeDevice(id).subscribe(() => this.loadAllData());
      }
    });
  }

  onClearAllDevices() {
    this.modalService.confirm({
      title: 'إخلاء جميع الأجهزة',
      message: 'هل أنت متأكد من إخلاء جميع الأجهزة المسجلة؟',
      confirmType: 'danger',
      onConfirm: () => {
        this.studentService.logoutAllDevices(this.studentId).subscribe(() => this.loadAllData());
      }
    });
  }

  // Access Management
  openOverrideModal(existing?: any) {
    if (existing) {
      this.overrideForm = {
        lessonId: existing.lessonId,
        expiresAt: existing.expiresAt ? new Date(existing.expiresAt).toISOString().split('T')[0] : '',
        allowVideoAccess: existing.allowVideoAccess,
        allowHomeworkAccess: existing.allowHomeworkAccess,
        maxViews: existing.maxViews,
        note: existing.note
      };
    } else {
      this.overrideForm = { lessonId: null, expiresAt: '', allowVideoAccess: true, allowHomeworkAccess: true, maxViews: 3, note: '' };
    }
    this.showOverrideModal.set(true);
  }

  onConfirmOverride() {
    if (!this.overrideForm.lessonId) return;
    this.isSaving.set(true);
    
    const payload = {
      ...this.overrideForm,
      lessonId: Number(this.overrideForm.lessonId)
    };

    this.studentService.saveOverride(this.studentId, payload).subscribe({
      next: () => {
        this.loadOverrides();
        this.showOverrideModal.set(false);
        this.isSaving.set(false);
        this.showStatus('تم منح الصلاحية بنجاح ✅', 'success');
      },
      error: (err) => {
        this.isSaving.set(false);
        this.showStatus(err.error?.message || 'فشل في حفظ الصلاحية', 'error');
      }
    });
  }

  onDeleteOverride(lessonId: number) {
    this.modalService.confirm({
      title: 'حذف الصلاحية',
      message: 'هل أنت متأكد من حذف هذه الصلاحية اليدوية؟',
      confirmType: 'danger',
      onConfirm: () => {
        this.studentService.deleteOverride(this.studentId, lessonId).subscribe(() => this.loadOverrides());
      }
    });
  }

  openExtendModal(att: any) {
    this.extendForm = {
      attendanceId: att.id,
      expiresAt: att.accessExpiresAt ? new Date(att.accessExpiresAt).toISOString().split('T')[0] : '',
      lessonTitle: att.lesson?.title || 'محاضرة'
    };
    this.showExtendModal.set(true);
  }

  onConfirmExtend() {
    this.isSaving.set(true);
    this.studentService.extendAttendance(this.studentId, this.extendForm.attendanceId, this.extendForm.expiresAt).subscribe({
      next: () => {
        this.loadOverrides();
        this.showExtendModal.set(false);
        this.isSaving.set(false);
      },
      error: () => this.isSaving.set(false)
    });
  }

  isExpired(date: any): boolean {
    if (!date) return false;
    return new Date(date).getTime() < Date.now();
  }

  getRemainingDaysText(endsAt: any): string {
    if (!endsAt) return 'وصول دائم';
    const diff = new Date(endsAt).getTime() - Date.now();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    
    if (days <= 0) return 'منتهي';
    if (days === 1) return 'متبقي يوم واحد';
    if (days === 2) return 'متبقي يومان';
    if (days <= 10) return `متبقي ${days} أيام`;
    return `متبقي ${days} يوم`;
  }

  getRemainingColor(endsAt: any): string {
    if (!endsAt) return 'bg-emerald-500/90 text-white';
    const diff = new Date(endsAt).getTime() - Date.now();
    const days = diff / (1000 * 60 * 60 * 24);
    
    if (days < 2) return 'bg-rose-500 text-white animate-pulse';
    if (days < 4) return 'bg-amber-500 text-white';
    return 'bg-emerald-500 text-white';
  }

  // WhatsApp
  openWaModal() {
    const student = this.student();
    if (!student) return;
    this.waMessage = `أهلاً يا ${student.studentName}، نود إبلاغك بـ ...`;
    this.isWaModalOpen.set(true);
  }

  closeWaModal() {
    this.isWaModalOpen.set(false);
  }

  sendWaMessage() {
    const student = this.student();
    if (!this.waMessage || !student) return;
    this.isSaving.set(true);
    
    this.whatsappService.sendDirect(student.studentPhone, this.waMessage)
      .pipe(finalize(() => this.isSaving.set(false)))
      .subscribe({
        next: () => {
          this.showStatus('تم إرسال الرسالة بنجاح ✅', 'success');
          this.closeWaModal();
        },
        error: (err) => this.showStatus(err.error?.message || 'فشل الإرسال. تأكد من ربط الواتساب أولاً.', 'error')
      });
  }

  // Export Performance Report
  exportPerformanceReport() {
    const stats = this.performanceStats();
    if (!stats) return;

    const studentName = this.student()?.studentName || 'Student';
    const date = new Date().toISOString().split('T')[0];
    const filename = `Performance_${studentName}_${date}.csv`;

    // 1. Prepare Export Data
    let csvContent = "\ufeff"; // BOM for Arabic support
    
    // Header
    csvContent += "تقرير أداء الطالب\n";
    csvContent += `الاسم: ${studentName}\n`;
    csvContent += `التاريخ: ${date}\n\n`;

    // Summary Stats
    csvContent += "ملخص الأداء\n";
    csvContent += "متوسط درجات الاختبارات,إنجاز المنهج,نسبة الحضور,أيام التفاعل\n";
    csvContent += `${stats.avgExamScore || 0}%,${stats.courseProgress || 0}%,${stats.attendanceRate || 0}%,${stats.activeDays || 0}\n\n`;

    // Exams Section
    csvContent += "سجل الاختبارات\n";
    csvContent += "الامتحان,الدرجة,التاريخ,الحالة\n";
    if (stats.recentExams?.length) {
      stats.recentExams.forEach((e: any) => {
        csvContent += `${e.examTitle},${e.score}%,${new Date(e.submittedAt).toLocaleDateString('ar-EG')},${e.score >= 50 ? 'ناجح' : 'راسب'}\n`;
      });
    } else {
      csvContent += "لا توجد بيانات اختبارات\n";
    }
    csvContent += "\n";

    // Lessons Section
    csvContent += "متابعة المحاضرات\n";
    csvContent += "المحاضرة,نسبة المشاهدة,آخر تفاعل,الوضعية\n";
    if (stats.lessonProgress?.length) {
      stats.lessonProgress.forEach((p: any) => {
        csvContent += `${p.lessonTitle},${p.watchPercentage}%,${new Date(p.updatedAt).toLocaleDateString('ar-EG')},${p.fullyWatched ? 'مكتملة' : 'قيد المشاهدة'}\n`;
      });
    } else {
      csvContent += "لا توجد بيانات محاضرات\n";
    }

    // 2. Trigger Download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }
}
