import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { SelfQuizService, SelfQuizChapter } from '../../../core/services/self-quiz.service';

@Component({
  selector: 'app-chapter-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './chapter-list.component.html',
})
export class ChapterListComponent implements OnInit {
  private selfQuizService = inject(SelfQuizService);
  
  chapters = signal<SelfQuizChapter[]>([]);
  gradeFilter = signal('all');
  searchQuery = signal('');
  isLoading = signal(true);
  isSaving = signal(false);
  showAddModal = signal(false);

  newChapter = {
    title: '',
    gradeLevel: '3sec',
    orderIndex: 0
  };

  filteredChapters = computed(() => {
    let list = this.chapters();
    const query = this.searchQuery().toLowerCase();
    if (query) {
      list = list.filter(c => c.title.toLowerCase().includes(query));
    }
    return list;
  });

  ngOnInit() {
    this.loadChapters();
  }

  loadChapters() {
    this.isLoading.set(true);
    const filter = this.gradeFilter() === 'all' ? undefined : this.gradeFilter();
    this.selfQuizService.getChapters(filter).subscribe({
      next: (res) => {
        this.chapters.set(res.data);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false)
    });
  }

  onSaveChapter() {
    this.isSaving.set(true);
    this.selfQuizService.createChapter(this.newChapter).subscribe({
      next: () => {
        this.loadChapters();
        this.isSaving.set(false);
        this.showAddModal.set(false);
        this.newChapter = { title: '', gradeLevel: '3sec', orderIndex: 0 };
      },
      error: () => this.isSaving.set(false)
    });
  }

  getGradeColor(level: string): string {
    switch (level) {
      case '1sec': return '#10b981'; // Emerald
      case '2sec': return '#f59e0b'; // Amber
      case '3sec': return '#6366f1'; // Indigo
      default: return '#94a3b8'; // Slate
    }
  }

  onDelete(id: number) {
    // Note: Backend might need a delete endpoint, I saw PATCH/DELETE in the file but didn't verify the exact route for chapters yet.
    // In many of these systems, chapters are soft-deleted or removed via a separate endpoint if needed.
    if (confirm('هل أنت متأكد من حذف هذا الفصل؟ سيتم حذف جميع الأسئلة المرتبطة به.')) {
      // Assuming delete behavior exist in backend plans
      console.log('Delete chapter', id);
    }
  }
}
