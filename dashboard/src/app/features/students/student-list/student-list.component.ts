import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { StudentService, Student } from '../../../core/services/student.service';
import { CenterService, Center } from '../../../core/services/center.service';
import { WhatsappService } from '../../../core/services/whatsapp.service';
import { finalize } from 'rxjs';
import { IconComponent } from '../../../shared/components/icon/icon.component';

@Component({
  selector: 'app-student-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, IconComponent],
  templateUrl: './student-list.component.html'
})
export class StudentListComponent implements OnInit {
  private studentService = inject(StudentService);
  private centerService = inject(CenterService);
  private whatsappService = inject(WhatsappService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  
  students = signal<any[]>([]);
  centers = signal<Center[]>([]);
  stats = signal<any>(null);
  isLoading = signal(false);
  isModalOpen = signal(false);
  isEditing = signal(false);
  isSaving = signal(false);
  
  searchTerm = '';
  selectedGrade = '';
  selectedCenterId: number | null = null;
  selectedRegion = '';
  hasBalance = false;
  startDate = '';
  endDate = '';

  // Premium Feedback & Modals
  statusModal = signal(false);
  statusMessage = signal('');
  statusType = signal<'success' | 'error'>('success');

  isDeleteModalOpen = signal(false);
  studentIdToDelete = signal<number | null>(null);

  isImportConfirmModalOpen = signal(false);
  studentsToImport = signal<any[]>([]);

  showStatus(msg: string, type: 'success' | 'error' = 'success') {
    this.statusMessage.set(msg);
    this.statusType.set(type);
    this.statusModal.set(true);
    setTimeout(() => this.statusModal.set(false), 3000);
  }

  // WhatsApp
  isWaModalOpen = signal(false);
  waTargetStudent = signal<any>(null);
  waMessage = '';

  pagination = signal({
    total: 0,
    page: 1,
    pageSize: 20,
    totalPages: 1
  });

  studentForm: any = {
    studentName: '',
    email: '',
    studentPhone: '',
    guardianPhone: '',
    year: 'الصف الاول الثانوي',
    region: '',
    centerCode: '',
    centerId: null,
    password: ''
  };

  // Export Settings
  isExportSettingsModalOpen = signal(false);
  exportFields = {
    id: signal(true),
    name: signal(true),
    email: signal(true),
    phone: signal(true),
    guardianPhone: signal(false),
    grade: signal(true),
    region: signal(true),
    centerCode: signal(false),
    centerName: signal(false),
    balance: signal(true),
    createdAt: signal(false)
  };

  ngOnInit() {
    this.loadCenters();
    this.route.queryParams.subscribe(params => {
      if (params['centerId']) {
        this.selectedCenterId = Number(params['centerId']);
      }
      this.loadStudents();
    });
    this.loadStats();
  }

  loadStats() {
    this.studentService.getStudentStats().subscribe({
      next: (res) => {
        if (res.data && res.data.byGrade) {
          const defaultGrades = ['الصف الاول الثانوي', 'الصف الثاني الثانوي', 'الصف الثالث الثانوي'];
          
          res.data.byGrade = defaultGrades.map((grade: string) => {
            const existing = res.data.byGrade.find((g: any) => g.year === grade);
            return existing ? existing : { year: grade, count: 0 };
          });
        }
        this.stats.set(res.data);
      }
    });
  }

  loadCenters() {
    this.centerService.getCenters().subscribe(res => {
      this.centers.set(res.data);
    });
  }

  loadStudents(page: number = 1) {
    this.isLoading.set(true);
    const params: any = {
      page: page,
      limit: this.pagination().pageSize
    };
    if (this.selectedGrade) params.grade = this.selectedGrade;
    if (this.searchTerm) params.search = this.searchTerm;
    if (this.selectedCenterId) params.centerId = this.selectedCenterId;
    if (this.selectedRegion) params.region = this.selectedRegion;
    if (this.hasBalance) params.hasBalance = true;
    if (this.startDate) params.startDate = this.startDate;
    if (this.endDate) params.endDate = this.endDate;

    this.studentService.getStudents(params).subscribe({
      next: (res) => {
        if (res.success) {
          this.students.set(res.data.students);
          this.pagination.set(res.data.pagination);
        } else {
          this.students.set([]);
        }
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
        this.students.set([]);
      }
    });
  }

  goToPage(page: number) {
    if (page < 1 || page > this.pagination().totalPages) return;
    this.loadStudents(page);
  }

  onSearch() {
    this.loadStudents(1);
  }

  openAddModal() {
    this.isEditing.set(false);
    this.studentForm = {
      studentName: '',
      email: '',
      studentPhone: '',
      guardianPhone: '',
      year: 'الصف الاول الثانوي',
      region: '',
      centerCode: '',
      centerId: null,
      password: ''
    };
    this.isModalOpen.set(true);
  }

  openEditModal(student: any) {
    this.isEditing.set(true);
    this.studentForm = { ...student };
    this.isModalOpen.set(true);
  }

  closeModal() {
    this.isModalOpen.set(false);
  }

  onSubmit() {
    this.isSaving.set(true);

    if (this.studentForm.studentPhone === this.studentForm.guardianPhone) {
      this.showStatus('يجب أن يكون رقم الطالب مختلفاً عن رقم ولي الأمر', 'error');
      this.isSaving.set(false);
      return;
    }
    
    // Only send mutable fields to the backend for PATCH
    const cleanData = {
      studentName: this.studentForm.studentName,
      email: this.studentForm.email,
      studentPhone: this.studentForm.studentPhone,
      guardianPhone: this.studentForm.guardianPhone,
      year: this.studentForm.year,
      region: this.studentForm.region,
      centerCode: this.studentForm.centerCode,
      centerId: this.studentForm.centerId || null
      // We explicitly exclude id, createdAt, etc.
    };

    if (this.isEditing()) {
      this.studentService.updateStudent(this.studentForm.id, cleanData).subscribe({
        next: () => {
          this.loadStudents(this.pagination().page);
          this.closeModal();
          this.isSaving.set(false);
          this.showStatus('تم تحديث بيانات الطالب بنجاح ✅', 'success');
        },
        error: (err) => {
          this.isSaving.set(false);
          const backendErrors = err.error?.errors ? err.error.errors.join('\n') : err.error?.message;
          this.showStatus(backendErrors || 'فشل تحديث البيانات. تأكد من صحة الحقول.', 'error');
        }
      });
    } else {
      // For creation, we also include password
      const createData = { ...cleanData, password: this.studentForm.password };
      this.studentService.createStudent(createData).subscribe({
        next: () => {
          this.loadStudents(1);
          this.closeModal();
          this.isSaving.set(false);
          this.showStatus('تم إضافة الطالب بنجاح ✅', 'success');
        },
        error: (err) => {
          this.isSaving.set(false);
          const backendErrors = err.error?.errors ? err.error.errors.join('\n') : err.error?.message;
          this.showStatus(backendErrors || 'فشل إضافة الطالب. تأكد من صحة البيانات.', 'error');
        }
      });
    }
  }

  onDelete(id: number) {
    this.studentIdToDelete.set(id);
    this.isDeleteModalOpen.set(true);
  }

  closeDeleteModal() {
    this.isDeleteModalOpen.set(false);
    this.studentIdToDelete.set(null);
  }

  confirmDelete() {
    const id = this.studentIdToDelete();
    if (!id) return;

    this.studentService.deleteStudent(id).subscribe({
      next: () => {
        this.showStatus('تم حذف الطالب بنجاح 🗑️', 'success');
        this.loadStudents(this.pagination().page);
        this.closeDeleteModal();
      },
      error: () => this.showStatus('فشل في حذف الطالب', 'error')
    });
  }

  resetFilters() {
    this.searchTerm = '';
    this.selectedGrade = '';
    this.selectedCenterId = null;
    this.selectedRegion = '';
    this.hasBalance = false;
    this.startDate = '';
    this.endDate = '';
    this.loadStudents(1);
  }

  // WhatsApp
  openWaModal(student: any) {
    this.waTargetStudent.set(student);
    this.waMessage = `أهلاً يا ${student.studentName}، نود إبلاغك بـ ...`;
    this.isWaModalOpen.set(true);
  }

  closeWaModal() {
    this.isWaModalOpen.set(false);
    this.waTargetStudent.set(null);
  }

  sendWaMessage() {
    if (!this.waMessage || !this.waTargetStudent()) return;
    this.isSaving.set(true);
    
    this.whatsappService.sendDirect(this.waTargetStudent().studentPhone, this.waMessage)
      .pipe(finalize(() => this.isSaving.set(false)))
      .subscribe({
        next: () => {
          this.showStatus('تم إرسال الرسالة بنجاح ✅', 'success');
          this.closeWaModal();
        },
        error: (err) => this.showStatus(err.error?.message || 'فشل الإرسال. تأكد من ربط الواتساب أولاً.', 'error')
      });
  }

  grantCertificate(student: any) {
    this.router.navigate(['/certificates'], { queryParams: { studentId: student.id } });
  }

  // ===================================================================
  // 📊 CSV Export & Import
  // ===================================================================

  openExportSettings() {
    console.log('Opening export settings...');
    this.isLoading.set(false); // Ensure it's not stuck
    this.isExportSettingsModalOpen.set(true);
  }

  closeExportSettings() {
    console.log('Closing export settings...');
    this.isExportSettingsModalOpen.set(false);
  }

  isFieldSelected(field: string): boolean {
    return (this.exportFields as any)[field]?.() || false;
  }

  toggleExportField(field: any) {
    const f = (this.exportFields as any)[field];
    if (f) f.set(!f());
  }

  exportToCsv() {
    console.log('Starting CSV export process...');
    this.isLoading.set(true);
    const params = {
      grade: this.selectedGrade,
      centerId: this.selectedCenterId,
      region: this.selectedRegion,
      hasBalance: this.hasBalance,
      startDate: this.startDate,
      endDate: this.endDate
    };

    this.studentService.getAllStudents(params).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        if (!res.success || !res.data.students.length) {
          this.showStatus('لا توجد بيانات لتصديرها', 'error');
          return;
        }

        const data = res.data.students;
        const headers: string[] = [];
        const config = this.exportFields;

        if (config.id()) headers.push('ID');
        if (config.name()) headers.push('Name');
        if (config.email()) headers.push('Email');
        if (config.phone()) headers.push('Phone');
        if (config.guardianPhone()) headers.push('Guardian Phone');
        if (config.grade()) headers.push('Grade');
        if (config.region()) headers.push('Region');
        if (config.centerCode()) headers.push('Center Code');
        if (config.centerName()) headers.push('Center Name');
        if (config.balance()) headers.push('Balance (EGP)');
        if (config.createdAt()) headers.push('Registration Date');

        const rows = data.map((s: any) => {
          const row: string[] = [];
          if (config.id()) row.push(s.id);
          if (config.name()) row.push(`"${s.studentName}"`);
          if (config.email()) row.push(s.email || '');
          if (config.phone()) row.push(s.studentPhone);
          if (config.guardianPhone()) row.push(s.guardianPhone || '');
          if (config.grade()) row.push(s.year);
          if (config.region()) row.push(`"${s.region || ''}"`);
          if (config.centerCode()) row.push(s.centerCode || '');
          if (config.centerName()) row.push(`"${s.centerName || ''}"`);
          if (config.balance()) row.push((s.balanceCents / 100).toFixed(2));
          if (config.createdAt()) row.push(s.createdAt ? new Date(s.createdAt).toLocaleDateString('ar-EG') : '');
          return row;
        });

        const csvContent = "\uFEFF" + [headers.join(','), ...rows.map((r: any) => r.join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `students_export_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        this.closeExportSettings();
      },
      error: () => {
        this.isLoading.set(false);
        this.showStatus('فشل تصدير البيانات', 'error');
      }
    });
  }

  triggerImport() {
    const fileInput = document.getElementById('csvImportInput') as HTMLInputElement;
    if (fileInput) fileInput.click();
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e: any) => {
      const text = e.target.result;
      this.processCsvData(text);
      event.target.value = ''; // Reset input
    };
    reader.readAsText(file);
  }

  private processCsvData(text: string) {
    const lines = text.split('\n');
    if (lines.length < 2) return;

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
    const dataRows = lines.slice(1);
    
    const studentsToImport: any[] = [];

    dataRows.forEach(line => {
      const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
      if (values.length < 3) return;

      const student: any = {};
      headers.forEach((h, i) => {
        if (h.includes('name')) student.studentName = values[i];
        if (h.includes('email')) student.email = values[i];
        if (h.includes('phone') && !h.includes('guardian')) student.studentPhone = values[i];
        if (h.includes('guardian')) student.guardianPhone = values[i];
        if (h.includes('year') || h.includes('grade')) student.year = values[i];
        if (h.includes('region')) student.region = values[i];
        if (h.includes('center') && h.includes('code')) student.centerCode = values[i];
        if (h.includes('password')) student.password = values[i];
      });

      if (student.studentName && (student.email || student.studentPhone)) {
        studentsToImport.push(student);
      }
    });

    if (studentsToImport.length === 0) {
      this.showStatus('لم يتم العثور على بيانات صالحة في الملف. تأكد من وجود رؤوس الأعمدة (name, email, phone).', 'error');
      return;
    }

    this.showImportConfirm(studentsToImport);
  }

  showImportConfirm(students: any[]) {
    this.studentsToImport.set(students);
    this.isImportConfirmModalOpen.set(true);
  }

  closeImportModal() {
    this.isImportConfirmModalOpen.set(false);
    this.studentsToImport.set([]);
  }

  confirmBulkImport() {
    const studentsToImport = this.studentsToImport();
    this.isLoading.set(true);
    
    this.studentService.bulkImport(studentsToImport).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        this.closeImportModal();
        const { success, updated, failed } = res.data;
        this.showStatus('تمت المعالجة: \n+ إضافة: ' + success + '\n* تحديث: ' + updated + '\n- فشل: ' + failed, 'success');
        this.loadStudents(1);
        this.loadStats();
      },
      error: (err) => {
        this.isLoading.set(false);
        this.closeImportModal();
        this.showStatus(err.error?.message || 'فشل استيراد البيانات', 'error');
      }
    });
  }
}
