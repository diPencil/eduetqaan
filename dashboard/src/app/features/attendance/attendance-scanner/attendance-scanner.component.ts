import { Component, inject, signal, ViewChild, ElementRef, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { CenterService, Center } from '../../../core/services/center.service';
import { CourseService, Course } from '../../../core/services/course.service';
import { AttendanceService, AttendanceSession } from '../../../core/services/attendance.service';
import { finalize } from 'rxjs';

@Component({
  selector: 'app-attendance-scanner',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: './attendance-scanner.component.html',
  styles: [`
    :host { display: block; background-color: #f8fafc; min-height: 100vh; overflow-y: auto; }
    input::-webkit-outer-spin-button, input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
    
    .custom-scrollbar::-webkit-scrollbar { width: 4px; }
    .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
    .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
    .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }

    @keyframes scale-in-center {
      0% { transform: scale(0.9); opacity: 0; }
      100% { transform: scale(1); opacity: 1; }
    }
    .scale-in-center { animation: scale-in-center 0.3s cubic-bezier(0.250, 0.460, 0.450, 0.940) both; }
  `]
})
export class AttendanceScannerComponent implements OnInit {
  private centerService = inject(CenterService);
  private courseService = inject(CourseService);
  private attendanceService = inject(AttendanceService);

  @ViewChild('scanInput') scanInput!: ElementRef;

  viewMode = signal<'active' | 'history'>('active');
  centers = signal<Center[]>([]);
  courses = signal<Course[]>([]);
  availableLessons = signal<any[]>([]);
  students = signal<any[]>([]);
  sessions = signal<any[]>([]);
  
  setup = {
    centerId: null,
    courseId: null,
    lessonId: null
  };

  currentSession = signal<AttendanceSession | null>(null);
  activeSessionData = signal<AttendanceSession | null>(null);
  isStarting = signal(false);
  isScanning = signal(false);
  isLoadingStudents = signal(false);
  isLoadingSessions = signal(false);
  scanCode = '';
  searchTerm = '';
  lastResult = signal<any>(null);
  scanLog = signal<any[]>([]);

  // Computed stats
  presentCount = computed(() => this.students().filter(s => s.hasAttendance).length);
  absentCount = computed(() => this.students().length - this.presentCount());
  attendanceRate = computed(() => {
    const total = this.students().length;
    if (total === 0) return 0;
    return Math.round((this.presentCount() / total) * 100);
  });

  ngOnInit() {
    this.centerService.getCenters({ active: 'true' }).subscribe(res => this.centers.set(res.data));
    this.courseService.getCourses({ status: 'published' }).subscribe(res => this.courses.set(res.data));
  }

  onCourseChange() {
    this.setup.lessonId = null;
    this.availableLessons.set([]);
    if (this.setup.courseId) {
      this.courseService.getCourseWithLessons(this.setup.courseId).subscribe(res => {
        this.availableLessons.set(res.data.lessons || []);
      });
    }
  }

  switchToActive() {
    this.viewMode.set('active');
    const active = this.activeSessionData();
    if (this.currentSession()?.id !== active?.id) {
      this.currentSession.set(active);
      this.scanLog.set([]);
      this.lastResult.set(null);
      if (active) {
        this.loadRoster();
      } else {
        this.students.set([]);
      }
    }
  }

  switchToHistory() {
    this.viewMode.set('history');
    this.loadSessions();
  }

  loadSessions() {
    this.isLoadingSessions.set(true);
    this.attendanceService.getSessions({ limit: 50 }).pipe(
      finalize(() => this.isLoadingSessions.set(false))
    ).subscribe({
      next: (res) => this.sessions.set(res.data),
      error: () => alert('فشل تحميل السجلات السابقة')
    });
  }

  viewPastSession(session: any) {
    // Treat the past session as current for viewing purposes
    this.currentSession.set(session);
    this.viewMode.set('active');
    this.loadRoster();
    // Clear logs since it's an old session
    this.scanLog.set([]);
    this.lastResult.set(null);
  }

  startSession() {
    this.isStarting.set(true);
    this.attendanceService.startSession(this.setup as any).subscribe({
      next: (res) => {
        this.currentSession.set(res.data);
        this.activeSessionData.set(res.data);
        this.isStarting.set(false);
        this.loadRoster();
        setTimeout(() => this.scanInput?.nativeElement?.focus(), 100);
      },
      error: () => this.isStarting.set(false)
    });
  }

  loadRoster() {
    if (!this.currentSession()) return;
    const session = this.currentSession()!;
    
    // Attempt to find course for level, or use session level if stored
    const course = this.courses().find(c => c.id === session.courseId);
    
    this.isLoadingStudents.set(true);
    this.attendanceService.getCenterStudents(session.centerId, {
      courseId: session.courseId,
      lessonId: session.lessonId,
      level: (session as any).level || (course as any)?.level || '3sec'
    }).pipe(finalize(() => this.isLoadingStudents.set(false))).subscribe(res => {
      this.students.set(res.data.students || []);
    });
  }

  onScan() {
    const code = this.scanCode.trim();
    if (!code || !this.currentSession() || this.isScanning()) return;

    // Optional: Warn if scanning into a closed session
    if (this.currentSession()?.status === 'closed') {
      if (!confirm('هذه الجلسة مغلقة. هل تريد تسجيل الحضور فيها على أي حال؟')) {
        this.scanCode = '';
        return;
      }
    }

    this.isScanning.set(true);
    this.attendanceService.scanByCode(this.currentSession()!.id, code).subscribe({
      next: (res) => {
        this.lastResult.set(res);
        if (res.success) {
          const student: any = res.data.student;
          
          const isCompensation = student.centerId !== this.currentSession()!.centerId;
          
          // Add to log (remove previous entry if exists so it moves to top without duplicating)
          const currentLog = this.scanLog().filter(item => item.code !== student.centerCode);
          const newLog = [{ 
            studentName: student.studentName, 
            code: student.centerCode, 
            time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
            isNew: !res.data.alreadyPresent,
            isCompensation: isCompensation,
            originalCenterId: student.centerId
          }, ...currentLog].slice(0, 10);
          this.scanLog.set(newLog);
          
          // Update roster state locally (and add compensation students to the list)
          this.updateStudentStatusLocally(student, true);
          
          this.scanCode = '';
        }
        this.isScanning.set(false);
      },
      error: (err) => {
        this.lastResult.set({ success: false, message: err.error?.message || 'خطأ في عملية المسح' });
        this.isScanning.set(false);
        this.scanCode = '';
      }
    });
  }

  updateStudentStatusLocally(studentData: any, present: boolean) {
    const list = [...this.students()];
    const index = list.findIndex(s => s.id === studentData.id);
    if (index !== -1) {
      list[index] = { 
        ...list[index], 
        hasAttendance: present, 
        attendedAt: present ? new Date().toISOString() : null 
      };
    } else if (present) {
      // Not found in the roster? This is a compensation student or new student! Add them to the top.
      const isComp = studentData.centerId !== this.currentSession()!.centerId;
      list.unshift({
        id: studentData.id,
        studentName: studentData.studentName,
        centerCode: studentData.centerCode,
        centerId: studentData.centerId,
        hasAttendance: true,
        attendedAt: new Date().toISOString(),
        examScore: null,
        examMaxScore: null,
        note: isComp ? 'حضور تعويض' : null,
        isCompensation: isComp
      });
    }
    this.students.set(list);
  }

  toggleAttendance(student: any) {
    if (student.isSaving) return;
    const newStatus = !student.hasAttendance;
    
    this.updateStudentStatusLocally(student, newStatus);
    this.saveStudentState(student);
  }

  saveStudentState(student: any) {
    if (!this.currentSession()) return;
    student.isSaving = true;
    
    const payload = {
      centerId: this.currentSession()!.centerId,
      courseId: this.currentSession()!.courseId,
      lessonId: this.currentSession()!.lessonId,
      studentId: student.id,
      score: student.examScore,
      maxScore: student.examMaxScore,
      isAbsent: !student.hasAttendance,
      note: student.note
    };

    this.attendanceService.saveExamScore(payload).pipe(finalize(() => {
      student.isSaving = false;
      this.students.set([...this.students()]);
    })).subscribe({
      next: () => {
        alert('تم حفظ البيانات بنجاح ✅');
      },
      error: (err) => alert(err.error?.message || 'فشل حفظ البيانات')
    });
  }

  filteredStudents() {
    const term = this.searchTerm.toLowerCase();
    if (!term) return this.students();
    return this.students().filter(s => 
      s.studentName?.toLowerCase().includes(term) || 
      s.centerCode?.toLowerCase().includes(term)
    );
  }

  resetSession() {
    const msg = this.currentSession()?.status === 'active' 
      ? 'هل أنت متأكد من إنهاء جلسة الحضور؟' 
      : 'هل تريد إغلاق هذا التقرير والعودة؟';
      
    if (confirm(msg)) {
      this.currentSession.set(null);
      this.lastResult.set(null);
      this.scanLog.set([]);
      this.students.set([]);
      this.searchTerm = '';
    }
  }

  // Helpers
  getCenterName(id?: number) {
    return this.centers().find(c => c.id === id)?.name || 'سنتر غير معروف';
  }

  getCourseName(id?: number) {
    return this.courses().find(c => c.id === id)?.title || 'كورس غير معروف';
  }
}
