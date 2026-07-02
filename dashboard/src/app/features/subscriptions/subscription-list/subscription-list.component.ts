import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { PlanService, Plan } from '../../../core/services/plan.service';
import { StudentService, Student } from '../../../core/services/student.service';
import { Subscription } from '../../../core/interfaces/plan.interface';

import { IconComponent } from '../../../shared/components/icon/icon.component';
import { finalize } from 'rxjs';

@Component({
  selector: 'app-subscription-list',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, IconComponent, RouterModule],
  templateUrl: './subscription-list.component.html',
  styles: [`
    :host { display: block; }
    .animate-in { animation: fadeIn 0.3s ease-out; }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `]
})
export class SubscriptionListComponent implements OnInit {
  private planService = inject(PlanService);
  private studentService = inject(StudentService);
  private fb = inject(FormBuilder);
  
  subscriptions = signal<Subscription[]>([]);
  filteredSubscriptions = signal<Subscription[]>([]);
  plans = signal<Plan[]>([]);
  
  isLoading = signal(true);
  isSubmitting = signal(false);
  
  searchQuery = '';
  statusFilter = 'all';

  // Modals state
  isDeleteModalOpen = signal(false);
  subscriptionToDelete = signal<number | null>(null);

  isAddEditModalOpen = signal(false);
  isEditMode = signal(false);
  currentSubscriptionId = signal<number | null>(null);

  // Student Search State
  studentSearchQuery = signal('');
  studentSearchResults = signal<Student[]>([]);
  isSearchingStudent = signal(false);
  selectedStudentDetails = signal<Student | null>(null);
  private searchTimeout: any;

  // Form
  subForm: FormGroup = this.fb.group({
    studentId: ['', Validators.required],
    planId: ['', Validators.required],
    startAt: [''],
    endAt: [''],
    status: ['active']
  });

  // Notification state
  notification = signal<{show: boolean, type: 'success'|'error', message: string}>({ show: false, type: 'success', message: '' });

  ngOnInit() {
    this.loadSubscriptions();
    this.loadPlans();
  }

  loadPlans() {
    this.planService.getPlans().subscribe({
      next: (res) => {
        if (res.success) {
          this.plans.set(res.data);
        }
      }
    });
  }

  loadSubscriptions() {
    this.isLoading.set(true);
    this.planService.getAllSubscriptions().pipe(finalize(() => this.isLoading.set(false))).subscribe({
      next: (res) => {
        this.subscriptions.set(res.data || []);
        this.filterSubscriptions();
      }
    });
  }

  filterSubscriptions() {
    let list = this.subscriptions();

    if (this.statusFilter !== 'all') {
      list = list.filter(s => s.status === this.statusFilter);
    }

    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      list = list.filter(s => 
        (s.studentName?.toLowerCase().includes(q)) || 
        (s.planName?.toLowerCase().includes(q))
      );
    }

    this.filteredSubscriptions.set(list);
  }

  // Add / Edit Modal Logic
  openAddModal() {
    this.isEditMode.set(false);
    this.currentSubscriptionId.set(null);
    this.selectedStudentDetails.set(null);
    this.studentSearchQuery.set('');
    this.studentSearchResults.set([]);
    this.subForm.reset({ status: 'active' });
    this.subForm.get('studentId')?.enable(); // Can change student when adding
    this.isAddEditModalOpen.set(true);
  }

  openEditModal(sub: Subscription) {
    this.isEditMode.set(true);
    this.currentSubscriptionId.set(sub.id);
    
    this.selectedStudentDetails.set({
      id: sub.studentId,
      studentName: sub.studentName || 'غير معروف',
      email: '', studentPhone: '', guardianPhone: '', year: '', region: '', createdAt: ''
    });
    this.studentSearchQuery.set(sub.studentName || '');
    
    // Format dates for input type="date"
    const startAt = sub.startAt ? new Date(sub.startAt).toISOString().split('T')[0] : '';
    const endAt = sub.endAt ? new Date(sub.endAt).toISOString().split('T')[0] : '';

    this.subForm.patchValue({
      studentId: sub.studentId,
      planId: sub.planId,
      startAt: startAt,
      endAt: endAt,
      status: sub.status || 'active'
    });
    
    // Disable studentId in edit mode
    this.subForm.get('studentId')?.disable();
    this.isAddEditModalOpen.set(true);
  }

  closeAddEditModal() {
    this.isAddEditModalOpen.set(false);
    this.subForm.reset();
  }

  onStudentSearchInput() {
    const q = this.studentSearchQuery();
    if (!q || q.length < 2) {
      this.studentSearchResults.set([]);
      return;
    }
    
    if (this.searchTimeout) clearTimeout(this.searchTimeout);
    
    this.isSearchingStudent.set(true);
    this.searchTimeout = setTimeout(() => {
      this.studentService.getStudents({ search: q, limit: 5 }).pipe(finalize(() => this.isSearchingStudent.set(false))).subscribe({
        next: (res) => {
          if (res.success) {
            const studentsList = Array.isArray(res.data) ? res.data : (res.data?.students || []);
            this.studentSearchResults.set(studentsList);
          }
        }
      });
    }, 500);
  }

  selectStudent(student: Student) {
    this.selectedStudentDetails.set(student);
    this.subForm.patchValue({ studentId: student.id });
    this.studentSearchQuery.set(student.studentName);
    this.studentSearchResults.set([]);
  }

  clearSelectedStudent() {
    this.selectedStudentDetails.set(null);
    this.subForm.patchValue({ studentId: '' });
    this.studentSearchQuery.set('');
    this.studentSearchResults.set([]);
  }

  saveSubscription() {
    if (this.subForm.invalid) {
      this.subForm.markAllAsTouched();
      return;
    }

    const formValue = this.subForm.getRawValue(); // gets disabled fields too
    const payload: any = {
      planId: Number(formValue.planId),
      status: formValue.status
    };

    if (formValue.startAt) payload.startAt = formValue.startAt;
    if (formValue.endAt) payload.endAt = formValue.endAt;

    this.isSubmitting.set(true);

    if (this.isEditMode() && this.currentSubscriptionId()) {
      // EDIT
      this.planService.updateSubscription(this.currentSubscriptionId()!, payload).pipe(finalize(() => this.isSubmitting.set(false))).subscribe({
        next: (res) => {
          if (res.success) {
            this.showNotification('success', 'تم تعديل الاشتراك بنجاح');
            this.closeAddEditModal();
            this.loadSubscriptions();
          } else {
            this.showNotification('error', res.message || 'حدث خطأ أثناء التعديل');
          }
        },
        error: (err) => {
          this.showNotification('error', err.error?.message || 'حدث خطأ غير متوقع');
        }
      });
    } else {
      // ADD
      payload.studentId = Number(formValue.studentId);
      this.planService.createSubscription(payload).pipe(finalize(() => this.isSubmitting.set(false))).subscribe({
        next: (res) => {
          if (res.success) {
            this.showNotification('success', 'تم إضافة الاشتراك بنجاح');
            this.closeAddEditModal();
            this.loadSubscriptions();
          } else {
            this.showNotification('error', res.message || 'حدث خطأ أثناء الإضافة');
          }
        },
        error: (err) => {
          this.showNotification('error', err.error?.message || 'حدث خطأ غير متوقع');
        }
      });
    }
  }

  // Delete Modal Logic
  openDeleteModal(id: number) {
    this.subscriptionToDelete.set(id);
    this.isDeleteModalOpen.set(true);
  }

  closeDeleteModal() {
    this.isDeleteModalOpen.set(false);
    this.subscriptionToDelete.set(null);
  }

  confirmDelete() {
    const id = this.subscriptionToDelete();
    if (!id) return;

    this.isSubmitting.set(true);
    this.planService.deleteSubscription(id).pipe(finalize(() => this.isSubmitting.set(false))).subscribe({
      next: (res) => {
        if (res.success !== false) {
          this.showNotification('success', 'تم إلغاء الاشتراك بنجاح');
          this.closeDeleteModal();
          this.loadSubscriptions();
        } else {
          this.showNotification('error', res.message || 'حدث خطأ أثناء الإلغاء');
        }
      },
      error: (err) => {
         this.showNotification('error', err.error?.message || 'حدث خطأ غير متوقع');
      }
    });
  }

  showNotification(type: 'success'|'error', message: string) {
    this.notification.set({ show: true, type, message });
    setTimeout(() => {
      this.notification.update(n => ({ ...n, show: false }));
    }, 3000);
  }
}
