import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ExamService, Exam } from '../../../core/services/exam.service';
import { CourseService } from '../../../core/services/course.service';
import { IconComponent } from '../../../shared/components/icon/icon.component';

@Component({
  selector: 'app-exam-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, IconComponent],
  templateUrl: './exam-list.component.html',

  styles: []
})
export class ExamListComponent {
  private examService = inject(ExamService);
  private courseService = inject(CourseService);

  exams = signal<Exam[]>([]);
  courses = signal<any[]>([]);
  lessons = signal<any[]>([]);
  isLoading = signal(false);
  isModalOpen = signal(false);
  isEditing = signal(false);
  isSaving = signal(false);

  searchQuery = '';
  selectedGrade = '';
  selectedStatus = '';

  examForm: any = {
    title: '',
    description: '',
    grade: 'الصف الاول الثانوي',
    durationMin: 20,
    status: 'published',
    courseId: null,
    lessonId: null,
    isFree: false
  };

  // Status Modal (Premium Feedback)
  statusModal = signal(false);
  statusMessage = signal('');
  statusType = signal<'success' | 'error'>('success');

  constructor() {
    this.loadExams();
    this.loadCourses();
  }

  loadCourses() {
    this.courseService.getCourses({ limit: 1000 }).subscribe({
      next: (res) => {
        if (res.success) this.courses.set(res.data);
      }
    });
  }

  onCourseChange() {
    const courseId = this.examForm.courseId;
    this.lessons.set([]);
    if (!courseId) {
      this.examForm.lessonId = null;
      return;
    }
    
    this.courseService.getCourseWithLessons(courseId).subscribe({
      next: (res) => {
        if (res.success) {
          this.lessons.set(res.data.lessons || []);
        }
      }
    });
  }

  // Delete Confirmation Modal
  isDeleteModalOpen = signal(false);
  idToDelete = signal<number | null>(null);

  showStatus(msg: string, type: 'success' | 'error' = 'success') {
    this.statusMessage.set(msg);
    this.statusType.set(type);
    this.statusModal.set(true);
    setTimeout(() => this.statusModal.set(false), 3000);
  }

  loadExams() {
    this.isLoading.set(true);
    
    // Clean params: only include if they have a value
    const params: any = {};
    if (this.selectedGrade) params.grade = this.selectedGrade;
    if (this.selectedStatus) params.status = this.selectedStatus;
    if (this.searchQuery && this.searchQuery.trim()) params.q = this.searchQuery.trim();

    this.examService.getExams(params).subscribe({
      next: (res) => {
        if (res.success) this.exams.set(res.data);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false)
    });
  }

  onSearch() {
    this.loadExams();
  }

  openAddModal() {
    this.isEditing.set(false);
    this.lessons.set([]);
    this.examForm = { 
      title: '', 
      description: '', 
      grade: 'الصف الاول الثانوي', 
      durationMin: 20, 
      status: 'published',
      courseId: null,
      lessonId: null,
      isFree: false
    };
    this.isModalOpen.set(true);
  }

  openEditModal(exam: any) {
    this.isEditing.set(true);
    this.examForm = { ...exam };
    if (this.examForm.courseId) {
      this.onCourseChange();
    } else {
      this.lessons.set([]);
    }
    this.isModalOpen.set(true);
  }

  closeModal() {
    this.isModalOpen.set(false);
  }

  onSubmit() {
    this.isSaving.set(true);
    if (this.isEditing()) {
      this.examService.updateExam(this.examForm.id, this.examForm).subscribe({
        next: () => { 
          this.showStatus('تم تحديث بيانات الامتحان بنجاح', 'success');
          this.loadExams(); 
          this.closeModal(); 
          this.isSaving.set(false); 
        },
        error: (err) => {
          this.showStatus('فشل في تحديث الامتحان: ' + (err.error?.message || 'خطأ غير معروف'), 'error');
          this.isSaving.set(false);
        }
      });
    } else {
      this.examService.createExam(this.examForm).subscribe({
        next: () => { 
          this.showStatus('تم إضافة الامتحان بنجاح', 'success');
          // Clear filters to ensure the new exam is visible
          this.searchQuery = '';
          this.selectedGrade = '';
          this.selectedStatus = '';
          this.loadExams(); 
          this.closeModal(); 
          this.isSaving.set(false); 
        },
        error: (err) => {
          this.showStatus('فشل في إضافة الامتحان: ' + (err.error?.message || 'خطأ غير معروف'), 'error');
          this.isSaving.set(false);
        }
      });
    }
  }

  onDelete(id: number) {
    this.idToDelete.set(id);
    this.isDeleteModalOpen.set(true);
  }

  closeDeleteModal() {
    this.isDeleteModalOpen.set(false);
    this.idToDelete.set(null);
  }

  confirmDelete() {
    const id = this.idToDelete();
    if (!id) return;

    this.examService.deleteExam(id).subscribe({
      next: () => {
        this.showStatus('تم حذف الامتحان بنجاح', 'success');
        this.loadExams();
        this.closeDeleteModal();
      },
      error: (err) => {
        this.showStatus('فشل في حذف الامتحان', 'error');
        this.closeDeleteModal();
      }
    });
  }
}
