import { Component, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CourseService, Course } from '../../../core/services/course.service';
import { CourseLessonsModalComponent } from '../course-lessons-modal/course-lessons-modal.component';
import { IconComponent } from '../../../shared/components/icon/icon.component';

@Component({
  selector: 'app-course-list',
  standalone: true,
  imports: [CommonModule, FormsModule, CourseLessonsModalComponent, IconComponent],
  templateUrl: './course-list.component.html',

  styles: [`
    .custom-scrollbar::-webkit-scrollbar { width: 10px; }
    .custom-scrollbar::-webkit-scrollbar-track { background: #f8fafc; }
    .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 20px; border: 3px solid #f8fafc; }
    .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
    .no-scrollbar::-webkit-scrollbar { display: none; }
    .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
  `]
})
export class CourseListComponent {
  private courseService = inject(CourseService);

  courses = signal<Course[]>([]);
  isLoading = signal(false);
  isModalOpen = signal(false);
  isLessonsModalOpen = signal(false);
  isEditing = signal(false);
  isSaving = signal(false);

  selectedCourse = signal<Course | null>(null);

  // State for Tabs
  activeLevel = signal<string | null>(null);

  searchQuery = '';
  selectedStatus = '';

  // Hierarchical Grouping Logic
  allGroups = computed(() => {
    const data = this.courses();
    const levels = [
      { key: 'الاول الثانوي', display: 'الصف الأول الثانوي' },
      { key: 'الثاني الثانوي', display: 'الصف الثاني الثانوي' },
      { key: 'الثالث الثانوي', display: 'الصف الثالث الثانوي' }
    ];

    const groups = levels.map(lv => {
      const filtered = data.filter(c => c.level === lv.key || c.level.includes(lv.key));
      return {
        level: lv.key,
        displayName: lv.display,
        courses: filtered
      };
    });

    return groups;
  });

  // Filter courses for active tab
  activeLevelCourses = computed(() => {
    if (!this.activeLevel()) return [];
    const group = this.allGroups().find(g => g.level === this.activeLevel());
    return group ? group.courses : [];
  });

  courseForm: any = {
    title: '',
    slug: '',
    shortDesc: '',
    longDesc: '',
    coverImageUrl: '',
    level: 'الاول الثانوي',
    category: '',
    isFree: false,
    priceCents: 0,
    status: 'published'
  };

  // Switch to first tab when data loads
  constructor() {
    this.loadCourses();

    effect(() => {
      const groups = this.allGroups();
      if (groups.length > 0 && !this.activeLevel()) {
        this.activeLevel.set(groups[0].level);
      } else if (groups.length > 0 && !groups.some(g => g.level === this.activeLevel())) {
        // Current active level no longer has courses
        this.activeLevel.set(groups[0].level);
      }
    });
  }

  loadCourses() {
    this.isLoading.set(true);
    const params: any = { limit: 200 };
    if (this.searchQuery) params.q = this.searchQuery;
    if (this.selectedStatus) params.status = this.selectedStatus;

    this.courseService.getCourses(params).subscribe({
      next: (res) => {
        if (res.success) {
          this.courses.set(res.data);
        }
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false)
    });
  }

  onSearch() {
    this.loadCourses();
  }

  openAddModal() {
    this.isEditing.set(false);
    this.courseForm = {
      title: '',
      slug: '',
      shortDesc: '',
      longDesc: '',
      coverImageUrl: '',
      level: this.activeLevel() || 'الاول الثانوي',
      category: '',
      isFree: false,
      priceCents: 0,
      status: 'published'
    };
    this.isModalOpen.set(true);
  }

  openEditModal(course: Course) {
    this.isEditing.set(true);
    this.courseForm = { ...course };
    this.isModalOpen.set(true);
  }

  closeModal() {
    this.isModalOpen.set(false);
  }

  openLessonsModal(course: Course) {
    this.selectedCourse.set(course);
    this.isLessonsModalOpen.set(true);
  }

  closeLessonsModal() {
    this.selectedCourse.set(null);
    this.isLessonsModalOpen.set(false);
  }

  onSubmit() {
    this.isSaving.set(true);
    if (!this.courseForm.slug) {
      this.courseForm.slug = 'course-' + Date.now();
    }

    if (this.isEditing()) {
      this.courseService.updateCourse(this.courseForm.id, this.courseForm).subscribe({
        next: () => {
          this.loadCourses();
          this.closeModal();
          this.isSaving.set(false);
        },
        error: (err) => {
          console.error('Update Course Error:', err);
          alert('خطأ في التحديث: ' + (err.error?.message || JSON.stringify(err.error?.errors || err.message)));
          this.isSaving.set(false);
        }
      });
    } else {
      this.courseService.createCourse(this.courseForm).subscribe({
        next: () => {
          this.loadCourses();
          this.closeModal();
          this.isSaving.set(false);
        },
        error: (err) => {
          console.error('Create Course Error:', err);
          alert('خطأ في الإنشاء: ' + (err.error?.message || JSON.stringify(err.error?.errors || err.message)));
          this.isSaving.set(false);
        }
      });
    }
  }

  onDelete(id: number) {
    if (confirm('هل أنت متأكد من حذف هذا الكورس نهائياً؟ سيتم حذف جميع الدروس المرتبطة به أيضاً.')) {
      this.courseService.deleteCourse(id).subscribe({
        next: () => {
          this.loadCourses();
        }
      });
    }
  }

  onPublish(id: number) {
    this.courseService.publishCourse(id).subscribe(() => this.loadCourses());
  }

  onUnpublish(id: number) {
    this.courseService.unpublishCourse(id).subscribe(() => this.loadCourses());
  }

  resetFilters() {
    this.searchQuery = '';
    this.selectedStatus = '';
    this.loadCourses();
  }
}
