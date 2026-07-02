import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PlanService } from '../../../core/services/plan.service';
import { CourseService, Course } from '../../../core/services/course.service';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { Plan } from '../../../core/interfaces/plan.interface';
import { Grade, GRADE_LABELS } from '../../../core/constants/grades.enum';

@Component({
  selector: 'app-plan-list',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: './plan-list.component.html',

  styles: [`
    :host { display: block; }
    .line-clamp-2 {
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
  `]
})
export class PlanListComponent implements OnInit {
  private planService = inject(PlanService);
  private courseService = inject(CourseService);
  
  gradesList = Object.values(Grade);
  
  plans = signal<Plan[]>([]);
  allCourses = signal<Course[]>([]);
  selectedCourseForLessons = signal<Course | null>(null);
  
  isLoading = signal(true);
  isSaving = signal(false);
  activeCount = signal(0);

  showModal = signal(false);
  editingPlan = signal<Plan | null>(null);

  form = {
    name: '',
    description: '',
    price: 0,
    periodDays: 30,
    isActive: true,
    scopeType: 'ALL' as any,
    scopeValue: '',
    includeCourseIds: [] as number[],
    includeLessonIds: [] as number[],
    grade: ''
  };

  ngOnInit() {
    this.loadPlans();
    this.loadAllCourses();
  }

  loadAllCourses() {
    this.courseService.getCourses({ limit: 1000 }).subscribe({
      next: (res) => {
        if (res.success) this.allCourses.set(res.data);
      }
    });
  }

  loadPlans() {
    this.isLoading.set(true);
    this.planService.getPlans().subscribe({
      next: (res) => {
        this.plans.set(res.data);
        this.activeCount.set(res.data.filter((p: Plan) => p.isActive).length);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false)
    });
  }

  getIcon(type: string): string {
    switch (type) {
      case 'ALL': return 'globe';
      case 'GRADE': return 'graduation-cap';
      case 'CATEGORY': return 'tag';
      case 'COURSE_LIST': return 'book-open';
      case 'LESSON_LIST': return 'video';
      default: return 'diamond';
    }
  }

  openAddModal() {
    this.editingPlan.set(null);
    this.selectedCourseForLessons.set(null);
    this.form = {
      name: '',
      description: '',
      price: 0,
      periodDays: 30,
      isActive: true,
      scopeType: 'ALL',
      scopeValue: '',
      includeCourseIds: [],
      includeLessonIds: [],
      grade: ''
    };
    this.showModal.set(true);
  }

  openEditModal(plan: Plan) {
    this.editingPlan.set(plan);
    this.selectedCourseForLessons.set(null);
    
    let parsedCourses: number[] = [];
    if (plan.includeCourseIds) {
      try { parsedCourses = typeof plan.includeCourseIds === 'string' ? JSON.parse(plan.includeCourseIds) : plan.includeCourseIds; } catch {}
    }
    
    let parsedLessons: number[] = [];
    if (plan.includeLessonIds) {
      try { parsedLessons = typeof plan.includeLessonIds === 'string' ? JSON.parse(plan.includeLessonIds) : plan.includeLessonIds; } catch {}
    }

    this.form = {
      name: plan.name,
      description: plan.description || '',
      price: plan.priceCents / 100,
      periodDays: plan.periodDays,
      isActive: plan.isActive,
      scopeType: plan.scopeType,
      scopeValue: plan.scopeValue || '',
      includeCourseIds: parsedCourses,
      includeLessonIds: parsedLessons,
      grade: plan.scopeStage || ''
    };
    this.showModal.set(true);
  }

  onCourseSelect(e: any, courseId: number) {
    if (e.target.checked) {
      if (!this.form.includeCourseIds.includes(courseId)) this.form.includeCourseIds.push(courseId);
    } else {
      this.form.includeCourseIds = this.form.includeCourseIds.filter(id => id !== courseId);
    }
  }

  onSelectCourseForLessons(event: any) {
    const courseId = Number(event.target.value);
    if (!courseId) {
      this.selectedCourseForLessons.set(null);
      return;
    }
    this.courseService.getCourseWithLessons(courseId).subscribe({
      next: (res) => {
        if (res.success) this.selectedCourseForLessons.set(res.data);
      }
    });
  }

  onLessonSelect(e: any, lessonId: number) {
    if (e.target.checked) {
      if (!this.form.includeLessonIds.includes(lessonId)) this.form.includeLessonIds.push(lessonId);
    } else {
      this.form.includeLessonIds = this.form.includeLessonIds.filter(id => id !== lessonId);
    }
  }

  closeModal() {
    this.showModal.set(false);
  }

  onSave() {
    if (!this.form.name || this.form.price < 0) return;
    
    this.isSaving.set(true);
    const payload = {
      ...this.form,
      priceCents: this.form.price * 100,
      currency: 'EGP',
      courseIds: this.form.scopeType === 'COURSE_LIST' ? this.form.includeCourseIds : [],
      lessonIds: this.form.scopeType === 'LESSON_LIST' ? this.form.includeLessonIds : []
    };

    const request = this.editingPlan() 
      ? this.planService.updatePlan(this.editingPlan()!.id!, payload)
      : this.planService.createPlan(payload);

    request.subscribe({
      next: () => {
        this.loadPlans();
        this.isSaving.set(false);
        this.closeModal();
      },
      error: () => this.isSaving.set(false)
    });
  }

  onDelete(id: number) {
    if (confirm('هل أنت متأكد من حذف هذه الباقة؟ لا يمكن التراجع.')) {
      this.planService.deletePlan(id).subscribe(() => this.loadPlans());
    }
  }
}
