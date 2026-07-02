import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { QrService, QrSnippet } from '../../core/services/qr.service';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { finalize } from 'rxjs';

@Component({
  selector: 'app-qr-management',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: './qr-management.component.html',

  styles: [`
    :host { display: block; background-color: #fcfcfd; min-height: 100vh; }
    .scrollbar-hide::-webkit-scrollbar { display: none; }
  `]
})
export class QrManagementComponent implements OnInit {
  private qrService = inject(QrService);

  snippets = signal<QrSnippet[]>([]);
  courses = signal<any[]>([]);
  lessons = signal<any[]>([]);
  isLoading = signal(false);
  isSaving = false;
  isModalOpen = false;
  isEditing = false;
  searchQuery = '';

  activeCount = computed(() => this.snippets().filter(s => s.isActive).length);

  form: QrSnippet = this.resetForm();

  ngOnInit() {
    this.loadSnippets();
    this.loadCatalog();
  }

  loadSnippets() {
    this.isLoading.set(true);
    this.qrService.getQrSnippets({ q: this.searchQuery })
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe((res: { success: boolean; data: QrSnippet[] }) => this.snippets.set(res.data));
  }

  loadCatalog() {
    this.qrService.getCourses().subscribe((res: { success: boolean; data: any[] }) => this.courses.set(res.data));
  }

  onCourseChange() {
    this.lessons.set([]);
    this.form.lessonId = null as any;
    if (this.form.courseId) {
      this.qrService.getLessons(this.form.courseId).subscribe((res: { success: boolean; data: any[] }) => this.lessons.set(res.data));
    }
  }

  getQrUrl(token: string): string {
    // Generate QR using a public API for preview
    const studentScanUrl = `https://mohamedsamy-app.com/scan/${token}`; // Placeholder, replace with actual app URL
    return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(studentScanUrl)}`;
  }

  openCreateModal() {
    this.isEditing = false;
    this.form = this.resetForm();
    this.isModalOpen = true;
  }

  openEditModal(s: QrSnippet) {
    this.isEditing = true;
    this.form = { ...s };
    this.onCourseChange(); // Load lessons for the current course
    this.isModalOpen = true;
  }

  closeModal() {
    this.isModalOpen = false;
  }

  resetForm(): QrSnippet {
    return {
      title: '',
      courseId: null as any,
      lessonId: null as any,
      streamType: 'mp4',
      streamUrl: '',
      isActive: true
    };
  }

  onSubmit() {
    if (!this.form.title || !this.form.courseId || !this.form.lessonId) return;
    
    this.isSaving = true;
    if (this.isEditing) {
      this.qrService.updateQrSnippet(this.form.id!, this.form).pipe(finalize(() => this.isSaving = false)).subscribe((res: { success: boolean; data: QrSnippet }) => {
        this.loadSnippets();
        this.closeModal();
      });
    } else {
      this.qrService.createQrSnippet(this.form).pipe(finalize(() => this.isSaving = false)).subscribe((res: { success: boolean; data: QrSnippet }) => {
        this.loadSnippets();
        this.closeModal();
      });
    }
  }

  onDelete(id: number) {
    if (confirm('هل أنت متأكد من إلغاء تفعيل هذا الكود؟ لن يتمكن الطلاب من استخدامه.')) {
      this.qrService.deleteQrSnippet(id).subscribe((res: { success: boolean }) => this.loadSnippets());
    }
  }

  toggleActive(s: QrSnippet) {
    this.qrService.updateQrSnippet(s.id!, { isActive: !s.isActive }).subscribe((res: { success: boolean }) => this.loadSnippets());
  }

  downloadQr(s: QrSnippet) {
    const url =  this.getQrUrl(s.token!);
    const link = document.createElement('a');
    link.href = url;
    link.download = `QR_${s.title}.png`;
    
    // For external APIs, we might need a workaround for direct download
    // Like fetching the blob
    fetch(url).then(response => response.blob()).then(blob => {
      const blobUrl = window.URL.createObjectURL(blob);
      link.href = blobUrl;
      link.click();
      window.URL.revokeObjectURL(blobUrl);
    });
  }
}
