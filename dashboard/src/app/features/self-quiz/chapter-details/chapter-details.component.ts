import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { SelfQuizService, SelfQuizChapter, SelfQuizQuestion } from '../../../core/services/self-quiz.service';

@Component({
  selector: 'app-chapter-details',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './chapter-details.component.html',

  styles: [`
    .custom-scrollbar::-webkit-scrollbar { width: 6px; }
    .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
    .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
  `]
})
export class ChapterDetailsComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private selfQuizService = inject(SelfQuizService);

  chapterId = 0;
  chapter = signal<SelfQuizChapter | null>(null);
  questions = signal<SelfQuizQuestion[]>([]);
  isLoading = signal(true);
  isSaving = signal(false);
  showModal = signal(false);

  form = {
    body: '',
    imageUrl: '',
    explanation: '',
    orderIndex: 0,
    choices: [
      { label: '', imageUrl: '', isCorrect: true, orderIndex: 1 },
      { label: '', imageUrl: '', isCorrect: false, orderIndex: 2 },
      { label: '', imageUrl: '', isCorrect: false, orderIndex: 3 },
      { label: '', imageUrl: '', isCorrect: false, orderIndex: 4 },
    ]
  };

  ngOnInit() {
    this.route.params.subscribe(params => {
      this.chapterId = +params['id'];
      this.loadChapterData();
    });
  }

  loadChapterData() {
    this.isLoading.set(true);
    // Find chapter info from the list (or we could add getChapter in service)
    this.selfQuizService.getChapters().subscribe(res => {
      const c = res.data.find((item: any) => item.id === this.chapterId);
      if (c) this.chapter.set(c);
    });

    this.selfQuizService.getChapterQuestions(this.chapterId).subscribe({
      next: (res) => {
        this.questions.set(res.data);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false)
    });
  }

  openAddModal() {
    this.form = {
      body: '',
      imageUrl: '',
      explanation: '',
      orderIndex: this.questions().length + 1,
      choices: [
        { label: '', imageUrl: '', isCorrect: true, orderIndex: 1 },
        { label: '', imageUrl: '', isCorrect: false, orderIndex: 2 },
        { label: '', imageUrl: '', isCorrect: false, orderIndex: 3 },
        { label: '', imageUrl: '', isCorrect: false, orderIndex: 4 },
      ]
    };
    this.showModal.set(true);
  }

  addChoice() {
    this.form.choices.push({
      label: '',
      imageUrl: '',
      isCorrect: false,
      orderIndex: this.form.choices.length + 1
    });
  }

  removeChoice(index: number) {
    if (this.form.choices.length <= 2) return;
    this.form.choices.splice(index, 1);
    // Re-index remaining choices
    this.form.choices.forEach((c, i) => c.orderIndex = i + 1);
    // Ensure at least one is correct
    if (!this.hasCorrectChoice()) this.form.choices[0].isCorrect = true;
  }

  setCorrectChoice(index: number) {
    this.form.choices.forEach((c, i) => c.isCorrect = i === index);
  }

  hasCorrectChoice(): boolean {
    return this.form.choices.some(c => c.isCorrect);
  }

  onSaveQuestion() {
    this.isSaving.set(true);
    
    // Backend expects questions array for bulk upload
    const correctIndex = this.form.choices.findIndex(c => c.isCorrect);
    const questionsPayload = [{
        body: this.form.body,
        imageUrl: this.form.imageUrl || null,
        explanation: this.form.explanation || null,
        orderIndex: this.form.orderIndex,
        choices: this.form.choices.map(c => ({
            label: c.label,
            imageUrl: c.imageUrl || null,
            orderIndex: c.orderIndex
        })),
        correctIndex
    }];

    this.selfQuizService.createQuestionBulk(this.chapterId, questionsPayload).subscribe({
      next: () => {
        this.loadChapterData();
        this.isSaving.set(false);
        this.showModal.set(false);
      },
      error: () => this.isSaving.set(false)
    });
  }

  onDeleteQuestion(id: number) {
    if (confirm('هل أنت متأكد من حذف هذا السؤال من بنك الأسئلة؟')) {
      this.selfQuizService.deleteQuestion(id).subscribe(() => this.loadChapterData());
    }
  }
}
