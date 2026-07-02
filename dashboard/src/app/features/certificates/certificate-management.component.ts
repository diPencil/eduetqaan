import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { CertificateService, StudentCertificate } from '../../core/services/certificate.service';
import { StudentService } from '../../core/services/student.service';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { finalize, debounceTime, distinctUntilChanged, Subject } from 'rxjs';

@Component({
  selector: 'app-certificate-management',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: './certificate-management.component.html',

  styles: [`
    :host { display: block; background-color: #fcfcfd; min-height: 100vh; }
    .scrollbar-hide::-webkit-scrollbar { display: none; }
  `]
})
export class CertificateManagementComponent implements OnInit {
  private certService = inject(CertificateService);
  private studentService = inject(StudentService);
  private route = inject(ActivatedRoute);

  certificates = signal<StudentCertificate[]>([]);
  totalCount = signal(0);
  isLoading = signal(false);
  isSaving = false;
  isModalOpen = false;
  isEditing = false;
  searchQuery = '';
  filterType = '';

  // Issuing Form
  form: Partial<StudentCertificate> = {};
  studentSearch = '';
  studentResults = signal<any[]>([]);
  selectedStudent: any = null;
  private searchSubject = new Subject<string>();

  typeStats = computed(() => {
    const list = this.certificates();
    return {
      exam: list.filter(c => c.type === 'exam').length,
      course: list.filter(c => c.type === 'course').length,
      other: list.filter(c => c.type === 'other' || c.type === 'behavior').length,
    };
  });

  ngOnInit() {
    this.loadCertificates();

    // Check for studentId in URL (Quick Grant)
    this.route.queryParams.subscribe(params => {
      const sid = Number(params['studentId']);
      if (sid) {
        this.studentService.getStudent(sid).subscribe({
          next: (res: { success: boolean; data: any }) => {
            if (res.success) {
              setTimeout(() => {
                this.openCreateModal();
                this.selectStudent(res.data);
              }, 300);
            }
          },
          error: () => this.showAlert('⚠️ فشل العثور على بيانات الطالب المحدد.')
        });
      }
    });
    
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe((q: string) => {
      if (q.length < 2) {
        this.studentResults.set([]);
        return;
      }
      this.certService.searchStudents(q).subscribe((res: { success: boolean; data: any[] }) => this.studentResults.set(res.data));
    });
  }

  loadCertificates() {
    this.isLoading.set(true);
    this.certService.getCertificates({ q: this.searchQuery, type: this.filterType })
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe((res: { success: boolean; data: StudentCertificate[], count: number }) => {
        this.certificates.set(res.data);
        this.totalCount.set(res.count);
      });
  }

  onSearchChange() {
    this.loadCertificates();
  }

  onStudentSearch() {
    this.searchSubject.next(this.studentSearch);
  }

  selectStudent(s: any) {
    this.selectedStudent = s;
    this.form.studentId = s.id;
    this.studentResults.set([]);
    this.studentSearch = ''; // Clear search text to show it's selected cleanly
  }

  clearSelectedStudent() {
    this.selectedStudent = null;
    this.form.studentId = undefined;
    this.studentSearch = '';
    this.studentResults.set([]);
  }

  getTypeClass(type: string) {
    const base = 'px-2 py-1 rounded-lg text-[9px] font-black uppercase ';
    switch (type) {
      case 'exam': return base + 'bg-indigo-50 text-indigo-600 border-indigo-100';
      case 'course': return base + 'bg-emerald-50 text-emerald-600 border-emerald-100';
      case 'behavior': return base + 'bg-amber-50 text-amber-600 border-amber-100';
      default: return base + 'bg-slate-50 text-slate-500 border-slate-100';
    }
  }

  getTypeText(type: string) {
    switch (type) {
      case 'exam': return 'اختبار';
      case 'course': return 'كورس';
      case 'behavior': return 'سلوك';
      default: return 'أخرى';
    }
  }

  openCreateModal() {
    this.isEditing = false;
    this.form = { type: 'exam', maxScore: 100 };
    this.selectedStudent = null;
    this.studentSearch = '';
    this.isModalOpen = true;
  }

  openEditModal(c: StudentCertificate) {
    this.isEditing = true;
    this.form = { ...c };
    this.isModalOpen = true;
  }

  closeModal() {
    this.isModalOpen = false;
  }

  // Custom Alerts
  alertMessage = '';
  isAlertOpen = false;

  confirmMessage = '';
  isConfirmOpen = false;
  confirmAction: (() => void) | null = null;

  showAlert(msg: string) {
    this.alertMessage = msg;
    this.isAlertOpen = true;
  }

  closeAlert() {
    this.isAlertOpen = false;
    this.alertMessage = '';
  }

  showConfirm(msg: string, action: () => void) {
    this.confirmMessage = msg;
    this.confirmAction = action;
    this.isConfirmOpen = true;
  }

  closeConfirm() {
    this.isConfirmOpen = false;
    this.confirmMessage = '';
    this.confirmAction = null;
  }

  executeConfirm() {
    if (this.confirmAction) {
      this.confirmAction();
    }
    this.closeConfirm();
  }

  onSubmit() {
    if (!this.form.title || (!this.isEditing && !this.form.studentId)) return;

    this.isSaving = true;
    const obs = this.isEditing 
      ? this.certService.updateCertificate(this.form.id!, this.form)
      : this.certService.issueCertificate(this.form);

    obs.pipe(finalize(() => this.isSaving = false)).subscribe((res: { success: boolean; data: StudentCertificate }) => {
      this.loadCertificates();
      this.closeModal();
    });
  }

  onDelete(id: number) {
    this.showConfirm('هل أنت متأكد من حذف هذه الشهادة نهائياً؟', () => {
      this.certService.deleteCertificate(id).subscribe((res: { success: boolean }) => this.loadCertificates());
    });
  }

  downloadPdf(id: number) {
    const url = this.certService.getDownloadUrl(id);
    window.open(url, '_blank');
  }

  previewCertificate(id: number) {
    const url = this.certService.getPreviewUrl(id);
    window.open(url, '_blank');
  }
}
