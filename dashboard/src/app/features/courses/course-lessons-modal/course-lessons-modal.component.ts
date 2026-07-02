import { Component, inject, signal, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CourseService, Course } from '../../../core/services/course.service';
import { AttendanceService } from '../../../core/services/attendance.service';
import { CenterService, Center } from '../../../core/services/center.service';
import { IconComponent } from '../../../shared/components/icon/icon.component';

@Component({
   selector: 'app-course-lessons-modal',
   standalone: true,
   imports: [CommonModule, FormsModule, IconComponent],
   templateUrl: './course-lessons-modal.component.html',
})
export class CourseLessonsModalComponent implements OnInit {
   @Input() courseId!: number;
   @Input() courseTitle!: string;
   @Output() close = new EventEmitter<void>();

   private courseService = inject(CourseService);
   private attendanceService = inject(AttendanceService);
   private centerService = inject(CenterService);

   viewMode = signal<'management' | 'roster'>('management');
   lessons = signal<any[]>([]);
   centers = signal<Center[]>([]);
   selectedLesson = signal<any | null>(null);

   // Management State
   isFormOpen = signal(false);
   isEditing = signal(false);
   isSaving = signal(false);
   isFetchingDuration = signal(false);
   lessonForm: any = {
      title: '',
      kind: 'lesson',
      status: 'published',
      streamType: 'external',
      videoId: '',
      durationSec: 0,
      orderIndex: 1,
      resources: []
   };

   // Roster State
   roster = signal<any[]>([]);
   stats = signal({ present: 0, absent: 0 });
   isLoadingLessons = signal(false);
   isLoadingRoster = signal(false);
   selectedCenterId: number | null = null;

   ngOnInit() {
      this.loadLessons();
      this.loadCenters();
   }

   loadLessons() {
      this.isLoadingLessons.set(true);
      this.courseService.getCourseWithLessons(this.courseId).subscribe({
         next: (res) => {
            if (res.success) {
               this.lessons.set(res.data.lessons || []);
            }
            this.isLoadingLessons.set(false);
         },
         error: () => this.isLoadingLessons.set(false)
      });
   }

   loadCenters() {
      this.centerService.getCenters().subscribe(res => {
         this.centers.set(res.data);
      });
   }

   selectLesson(lesson: any) {
      this.selectedLesson.set(lesson);
      this.isFormOpen.set(false);
      if (this.viewMode() === 'roster' && this.selectedCenterId) {
         this.loadRoster();
      }
   }

   loadRoster() {
      if (!this.selectedLesson() || !this.selectedCenterId) return;
      this.isLoadingRoster.set(true);
      this.attendanceService.getLessonRoster({
         centerId: this.selectedCenterId,
         lessonId: this.selectedLesson().id,
         courseId: this.courseId
      }).subscribe({
         next: (res) => {
            if (res.success) {
               this.roster.set(res.data.students || []);
               this.stats.set({
                  present: res.data.totalPresentInCenter + res.data.totalPresentOnline,
                  absent: res.data.totalExpected - (res.data.totalPresentInCenter + res.data.totalPresentOnline)
               });
            }
            this.isLoadingRoster.set(false);
         },
         error: () => this.isLoadingRoster.set(false)
      });
   }

   fetchYoutubeDuration() {
      const videoIdOrUrl = this.lessonForm.videoId;
      if (!videoIdOrUrl) return;
      
      let videoId = videoIdOrUrl;
      const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
      const match = videoIdOrUrl.match(regExp);
      if (match && match[2].length === 11) {
         videoId = match[2];
      }

      if (videoId.length !== 11) {
         alert('يرجى إدخال رابط يوتيوب صحيح أو الـ Video ID مباشرة.');
         return;
      }

      this.isFetchingDuration.set(true);

      const container = document.createElement('div');
      container.style.position = 'absolute';
      container.style.left = '-9999px';
      container.id = 'yt-temp-player-' + Date.now();
      document.body.appendChild(container);

      if (!(window as any).YT) {
         const tag = document.createElement('script');
         tag.src = "https://www.youtube.com/iframe_api";
         const firstScriptTag = document.getElementsByTagName('script')[0];
         firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
      }

      const checkYT = setInterval(() => {
         if ((window as any).YT && (window as any).YT.Player) {
            clearInterval(checkYT);
            
            const player = new (window as any).YT.Player(container.id, {
               height: '10',
               width: '10',
               videoId: videoId,
               events: {
                  'onReady': (event: any) => {
                     const durationSec = event.target.getDuration();
                     if (durationSec > 0) {
                        this.lessonForm.durationMin = Math.round(durationSec / 60);
                     }
                     this.isFetchingDuration.set(false);
                     event.target.destroy();
                     container.remove();
                  },
                  'onError': (event: any) => {
                     this.isFetchingDuration.set(false);
                     alert('فشل في استخراج مدة الفيديو، قد يكون الفيديو خاصاً أو مقيداً.');
                     event.target.destroy();
                     container.remove();
                  }
               }
            });
            
            setTimeout(() => {
               if (this.isFetchingDuration()) {
                  this.isFetchingDuration.set(false);
                  try { player.destroy(); } catch(e) {}
                  container.remove();
                  alert('انتهى وقت الانتظار. يرجى إدخال المدة يدوياً.');
               }
            }, 8000);
         }
      }, 500);
   }

   // Management Logic
   openAddForm() {
      this.isFormOpen.set(true);
      this.isEditing.set(false);
      this.lessonForm = {
         title: '',
         kind: 'lesson',
         status: 'published',
         streamType: 'external',
         videoId: '',
         durationSec: 0,
         durationMin: 0,
         orderIndex: (this.lessons().length + 1),
         resources: []
      };
   }

   openEditForm(lesson: any) {
      this.isFormOpen.set(true);
      this.isEditing.set(true);
      this.lessonForm = { ...lesson, durationMin: lesson.durationSec ? Math.round(lesson.durationSec / 60) : 0 };
      
      // Ensure resources array exists
      if (!Array.isArray(this.lessonForm.resources)) {
         if (typeof this.lessonForm.resources === 'string') {
             try {
                 this.lessonForm.resources = JSON.parse(this.lessonForm.resources);
             } catch(e) {
                 this.lessonForm.resources = [];
             }
         } else {
             this.lessonForm.resources = [];
         }
      }
      
      // If streamType is not external, the backend might have stored the URL in streamUrl
      if (this.lessonForm.streamType !== 'external' && this.lessonForm.streamUrl && !this.lessonForm.videoId) {
         this.lessonForm.videoId = this.lessonForm.streamUrl;
      }
   }

   saveLesson() {
      this.isSaving.set(true);
      
      const payload = { ...this.lessonForm };
      payload.durationSec = (payload.durationMin || 0) * 60;
      
      // Map videoId back to streamUrl for mp4/hls as backend expects it there
      if (payload.streamType !== 'external' && payload.videoId) {
         payload.streamUrl = payload.videoId;
         // Note: we leave videoId as is or set it to null, backend ignores it for mp4/hls anyway
      }

      if (this.isEditing()) {
         this.courseService.updateLesson(this.courseId, payload.id, payload).subscribe({
            next: () => {
               this.loadLessons();
               this.isFormOpen.set(false);
               this.isSaving.set(false);
            },
            error: () => this.isSaving.set(false)
         });
      } else {
         this.courseService.createLesson(this.courseId, payload).subscribe({
            next: () => {
               this.loadLessons();
               this.isFormOpen.set(false);
               this.isSaving.set(false);
            },
            error: () => this.isSaving.set(false)
         });
      }
   }

   deleteLesson(lessonId: number) {
      if (confirm('هل أنت متأكد من حذف هذا المحتوى نهائياً؟')) {
         this.courseService.deleteLesson(this.courseId, lessonId).subscribe({
            next: () => {
               this.loadLessons();
               this.selectedLesson.set(null);
            }
         });
      }
   }

   // --- Resources Logic ---
   addResource() {
      if (!Array.isArray(this.lessonForm.resources)) {
          this.lessonForm.resources = [];
      }
      this.lessonForm.resources.push({ title: '', url: '', type: 'pdf' });
   }

   removeResource(index: number) {
      if (this.lessonForm.resources) {
         this.lessonForm.resources.splice(index, 1);
      }
   }

   trackByIndex(index: number, item: any): number {
      return index;
   }

   // --- Export Logic (High Compatibility CSV/Excel) ---
   exportRosterToExcel() {
      const data = this.roster();
      if (!data || data.length === 0) return;

      const lessonTitle = this.selectedLesson()?.title || 'Lecture';
      const centerName = this.centers().find(c => c.id === Number(this.selectedCenterId))?.name || 'Center';

      // Excel opening CSV reliably needs UTF-8 BOM and semicolon as a safe separator
      const BOM = '\uFEFF';
      let csvContent = 'اسم الطالب;كود الطالب;رقم الموبايل;الحالة;وقت الحضور\n';

      data.forEach(row => {
         const studentName = (row.fullName || '---').replace(/;/g, ' ');
         const studentCode = (row.code || '---').replace(/;/g, ' ');
         const phone = (row.phone || '---').replace(/;/g, ' ');
         const status = row.presentInCenter ? 'حاضر' : 'غائب';
         const time = row.lastAttendanceAt ? new Date(row.lastAttendanceAt).toLocaleString('ar-EG').replace(/;/g, ' ') : '---';

         csvContent += `${studentName};${studentCode};${phone};${status};${time}\n`;
      });

      // Sanitize filename for Mac/Safari: remove any special characters
      const safeLesson = (lessonTitle || 'Lecture').replace(/[^a-zA-Z0-9\u0621-\u064A]/g, '_').trim();
      const safeCenter = (centerName || 'Center').replace(/[^a-zA-Z0-9\u0621-\u064A]/g, '_').trim();
      const dateStr = new Date().toISOString().split('T')[0];
      const fileName = `Attendance_${safeLesson}_${dateStr}.csv`;

      // Modern browsers on Mac handle the CSV + BOM best
      const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8' });
      const link = document.createElement('a');

      if (link.download !== undefined) {
         const url = URL.createObjectURL(blob);
         link.setAttribute('href', url);
         link.setAttribute('download', fileName);
         link.style.visibility = 'hidden';
         document.body.appendChild(link);
         link.click();
         document.body.removeChild(link);
      }
   }
}
