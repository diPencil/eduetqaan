import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CenterService, Center } from '../../../core/services/center.service';
import { CourseService, Course } from '../../../core/services/course.service';
import { AttendanceService } from '../../../core/services/attendance.service';
import { ToastService } from '../../../shared/components/toast/toast.service';
import { finalize } from 'rxjs';

import { IconComponent } from '../../../shared/components/icon/icon.component';

@Component({
  selector: 'app-center-exams',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: './center-exams.component.html',

  styles: [`
    :host { display: block; background-color: #fcfcfd; min-height: 100vh; }
    input::-webkit-outer-spin-button, input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
  `]
})
export class CenterExamsComponent {
  private centerService = inject(CenterService);
  private courseService = inject(CourseService);
  private attendanceService = inject(AttendanceService);
  private toastService = inject(ToastService);

  activeTab = signal('none');
  centers = signal<Center[]>([]);
  allCourses = signal<Course[]>([]);
  filteredCourses = signal<Course[]>([]);
  lessons = signal<any[]>([]);
  students = signal<any[]>([]);
  stats = signal<any>({});

  filters = {
    centerId: null,
    level: '',
    courseId: null,
    lessonId: null
  };

  searchTerm = '';
  globalMaxScore = 20;
  isLoading = signal(false);
  isSaving = signal(false);

  constructor() {
    this.centerService.getCenters({ active: 'true' }).subscribe(res => this.centers.set(res.data));
    this.courseService.getCourses({ status: 'published' }).subscribe(res => this.allCourses.set(res.data));
  }

  onLevelChange() {
    this.filters.courseId = null;
    this.filters.lessonId = null;
    this.lessons.set([]);
    if (this.filters.level) {
      this.filteredCourses.set(this.allCourses().filter(c => c.level === this.filters.level));
    } else {
      this.filteredCourses.set([]);
    }
  }

  onCourseChange() {
    this.filters.lessonId = null;
    this.lessons.set([]);
    if (this.filters.courseId) {
      this.courseService.getCourseWithLessons(this.filters.courseId).subscribe(res => {
        this.lessons.set(res.data.lessons || []);
      });
    }
  }

  loadData() {
    if (!this.filters.centerId || !this.filters.courseId || !this.filters.lessonId) return;

    this.isLoading.set(true);
    if (this.activeTab() === 'none') this.activeTab.set('entry');

    if (this.activeTab() === 'entry') {
      this.attendanceService.getCenterStudents(this.filters.centerId!, {
        level: this.filters.level,
        courseId: this.filters.courseId!,
        lessonId: this.filters.lessonId!
      }).pipe(finalize(() => this.isLoading.set(false))).subscribe(res => {
        const list = res.data.students || [];
        // Extract global max if any student has it
        const firstWithMax = list.find((s: any) => s.examMaxScore != null);
        if (firstWithMax) this.globalMaxScore = firstWithMax.examMaxScore;
        this.students.set(list);
      });
    } else {
      // Reports mode
      this.attendanceService.getAbsenceReport({
        centerId: this.filters.centerId!,
        courseId: this.filters.courseId!,
        lessonId: this.filters.lessonId!,
        level: this.filters.level
      }).subscribe(reportRes => {
        const absents = reportRes.data?.absents || [];

        this.attendanceService.getCenterStudents(this.filters.centerId!, {
          level: this.filters.level,
          courseId: this.filters.courseId!,
          lessonId: this.filters.lessonId!
        }).pipe(finalize(() => this.isLoading.set(false))).subscribe(res => {
          const studentList = res.data.students || [];
          const attendees = studentList.filter((s: any) => s.examScore != null && !s.examIsAbsent);

          // Simple Stats Calculation
          const totalScore = attendees.reduce((acc: number, s: any) => acc + (s.examScore || 0), 0);
          const totalMax = attendees.reduce((acc: number, s: any) => acc + (s.examMaxScore || 1), 0);
          const maxVal = attendees.length ? Math.max(...attendees.map((a: any) => a.examScore)) : 0;

          const topStudents = [...attendees]
            .sort((a: any, b: any) => b.examScore - a.examScore)
            .slice(0, 10)
            .map((s: any) => ({ studentName: s.studentName, score: s.examScore, maxScore: s.examMaxScore }));

          this.stats.set({
            totalAttendees: attendees.length,
            absentCount: absents.length,
            avgScore: attendees.length ? (totalScore / totalMax) * 100 : 0,
            maxScore: maxVal,
            topStudents,
            absents
          });
        });
      });
    }
  }

  filteredStudents() {
    const term = this.searchTerm.toLowerCase();
    if (!term) return this.students();
    return this.students().filter(s =>
      s.studentName.toLowerCase().includes(term) ||
      s.centerCode?.toLowerCase().includes(term)
    );
  }

  applyGlobalMax() {
    this.students().forEach(s => {
      if (!s.examMaxScore) s.examMaxScore = this.globalMaxScore;
    });
  }

  saveBulkScores() {
    if (this.isSaving()) return;
    
    // Validate empty inputs
    const studentsList = this.students();
    for (const s of studentsList) {
      if (!s.examIsAbsent) {
        const hasScore = s.examScore != null && s.examScore !== '';
        const hasMax = s.examMaxScore != null && s.examMaxScore !== '';
        if ((hasScore && !hasMax) || (!hasScore && hasMax)) {
          this.toastService.error(`يرجى إكمال الدرجة والدرجة الكلية للطالب: ${s.studentName}`);
          return;
        }
      }
    }

    this.isSaving.set(true);

    const payload = {
      centerId: this.filters.centerId!,
      courseId: this.filters.courseId!,
      lessonId: this.filters.lessonId!,
      scores: studentsList.map(s => ({
        studentId: s.id,
        score: s.examScore === '' ? null : s.examScore,
        maxScore: s.examMaxScore === '' ? null : s.examMaxScore,
        isAbsent: !!s.examIsAbsent,
        note: s.examNote
      }))
    };

    this.attendanceService.bulkSaveExamScores(payload).pipe(finalize(() => this.isSaving.set(false))).subscribe({
      next: (res) => {
        this.toastService.success('تم حفظ كشف الدرجات بنجاح');
        
        // Update stats if we're in reports view or just to refresh state
        this.loadData();
      },
      error: (err) => {
        this.toastService.error(err.error?.message || 'فشل حفظ الدرجات');
      }
    });
  }

  saveScore(student: any) {
    if (student.isSaving) return;

    if (!student.examIsAbsent) {
      const hasScore = student.examScore != null && student.examScore !== '';
      const hasMax = student.examMaxScore != null && student.examMaxScore !== '';
      
      if (!hasScore && !hasMax) {
        this.toastService.error('الرجاء إدخال الدرجة أولاً');
        return;
      }
      if ((hasScore && !hasMax) || (!hasScore && hasMax)) {
        this.toastService.error('الرجاء إكمال الدرجة والدرجة الكلية معاً');
        return;
      }
      if (Number(student.examScore) > Number(student.examMaxScore)) {
        this.toastService.error('لا يمكن أن تكون الدرجة أكبر من الدرجة الكلية');
        return;
      }
    }

    student.isSaving = true;
    this.students.update(s => [...s]);

    const scoreVal = student.examScore === '' ? null : student.examScore;
    const maxScoreVal = student.examMaxScore === '' ? null : student.examMaxScore;

    const payload: any = {
      centerId: this.filters.centerId!,
      courseId: this.filters.courseId!,
      lessonId: this.filters.lessonId!,
      studentId: student.id,
      score: scoreVal,
      maxScore: maxScoreVal,
      isAbsent: !!student.examIsAbsent,
      note: student.examNote
    };

    this.attendanceService.saveExamScore(payload).pipe(finalize(() => {
      student.isSaving = false;
      this.students.update(s => [...s]);
    })).subscribe({
      next: () => {
        this.toastService.success('تم حفظ الدرجة بنجاح');
        // Auto-fill max score logic if applicable
        if (maxScoreVal && !this.globalMaxScore) {
          this.globalMaxScore = maxScoreVal;
        }
        if (maxScoreVal) {
           this.students.update(all => {
             all.forEach(st => {
                if (st.id !== student.id && (st.examMaxScore == null || st.examMaxScore === '')) {
                   st.examMaxScore = maxScoreVal;
                }
             });
             return [...all];
           });
        }
      },
      error: (err) => this.toastService.error(err.error?.message || 'فشل حفظ الدرجة')
    });
  }

  clearScore(student: any) {
    if (student.isSaving || (student.examScore == null && !student.examIsAbsent)) return;
    
    if (!confirm(`هل أنت متأكد من مسح درجة الطالب ${student.studentName} بالكامل؟`)) {
       return;
    }

    student.isSaving = true;
    this.students.update(s => [...s]);

    const payload = {
      centerId: this.filters.centerId!,
      courseId: this.filters.courseId!,
      lessonId: this.filters.lessonId!,
      studentId: student.id,
      clear: true // Using the new clear flag
    };

    // We can use the individual save endpoint with clear: true, or bulk with 1 row.
    // The single save endpoint might not have `clear` flag! Let's check.
    // Actually, setting score=null, maxScore=null without isAbsent does it in bulk.
    // Let's use the single endpoint but we need to ensure it handles clear.
    // In our backend single endpoint, if score=null and isAbsent=false, it deletes it.
    
    // So sending nulls without isAbsent deletes the row.
    const deletePayload: any = {
      centerId: this.filters.centerId!,
      courseId: this.filters.courseId!,
      lessonId: this.filters.lessonId!,
      studentId: student.id,
      score: null,
      maxScore: null,
      isAbsent: false,
      note: null,
      clear: true
    };

    this.attendanceService.saveExamScore(deletePayload).pipe(finalize(() => {
      student.isSaving = false;
      this.students.update(s => [...s]);
    })).subscribe({
      next: () => {
        student.examScore = null;
        student.examMaxScore = null;
        student.examIsAbsent = false;
        student.examNote = null;
        this.toastService.success('تم مسح الدرجة بنجاح');
      },
      error: (err) => this.toastService.error(err.error?.message || 'فشل مسح الدرجة')
    });
  }

  exportAbsents() {
    const data = this.stats().absents;
    if (!data.length) return;
    let csv = 'اسم الطالب,كود السنتر,موبايل الطالب,موبايل ولي الأمر\n';
    data.forEach((row: any) => {
      csv += `${row.studentName},${row.centerCode || ''},${row.phone || ''},${row.parentPhone || ''}\n`;
    });
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `غائبين_${this.filters.level}.csv`;
    link.click();
  }
}
