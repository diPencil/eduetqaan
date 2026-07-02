import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ExamService, Exam, ExamQuestion } from '../../../core/services/exam.service';
import { IconComponent } from '../../../shared/components/icon/icon.component';

@Component({
  selector: 'app-exam-questions',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, IconComponent],
  templateUrl: './exam-questions.component.html',
})
export class ExamQuestionsComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private examService = inject(ExamService);

  examId = 0;
  exam = signal<Exam | null>(null);
  questions = signal<ExamQuestion[]>([]);
  questionSearch = signal('');

  filteredQuestions = computed(() => {
    const query = this.questionSearch().toLowerCase().trim();
    if (!query) return this.questions();
    return this.questions().filter(q => q.text.toLowerCase().includes(query));
  });
  isModalOpen = signal(false);
  isSaving = signal(false);

  // Edit State
  isEditing = signal(false);
  editingId = signal<number | null>(null);

  // Premium Feedback & Modals
  statusModal = signal(false);
  statusMessage = signal('');
  statusType = signal<'success' | 'error'>('success');

  isDeleteModalOpen = signal(false);
  idToDelete = signal<number | null>(null);

  questionForm: any = {
    type: 'mcq',
    text: '',
    points: 1,
    options: ['', '', '', ''],
    correctIndex: 0,
    isTrue: true
  };

  ngOnInit() {
    this.route.params.subscribe(params => {
      this.examId = +params['id'];
      this.loadExam();
      this.loadQuestions();
    });
  }

  loadExam() {
    this.examService.getExam(this.examId).subscribe({
      next: (res) => this.exam.set(res.data),
      error: (err) => {
        console.error('Failed to load exam info:', err);
        this.showStatus('فشل تحميل تفاصيل الامتحان', 'error');
      }
    });
  }

  loadQuestions() {
    this.examService.getQuestions(this.examId).subscribe({
      next: (res) => this.questions.set(res.data),
      error: (err) => {
        console.error('Failed to load questions:', err);
        this.showStatus('فشل تحميل الأسئلة', 'error');
      }
    });
  }

  showStatus(msg: string, type: 'success' | 'error' = 'success') {
    this.statusMessage.set(msg);
    this.statusType.set(type);
    this.statusModal.set(true);
    setTimeout(() => this.statusModal.set(false), 3000);
  }

  getTotalPoints(): number {
    return this.questions().reduce((sum, q) => sum + (Number(q.points) || 0), 0);
  }

  openAddModal() {
    this.isEditing.set(false);
    this.editingId.set(null);
    this.resetForm();
    this.isModalOpen.set(true);
  }

  onEdit(q: ExamQuestion) {
    this.isEditing.set(true);
    this.editingId.set(q.id);
    
    // Determine type based on choices length
    const type = (q.choices && q.choices.length === 2) ? 'true_false' : 'mcq';
    
    this.questionForm = {
      type,
      text: q.text,
      points: q.points,
      options: type === 'mcq' ? [...(q.choices || ['', '', '', ''])] : ['', '', '', ''],
      correctIndex: q.correctIndex,
      isTrue: type === 'true_false' ? (q.correctIndex === 0) : true
    };
    
    this.isModalOpen.set(true);
  }

  resetForm() {
    this.questionForm = {
      type: 'mcq',
      text: '',
      points: 1,
      options: ['', '', '', ''],
      correctIndex: 0,
      isTrue: true
    };
  }

  closeModal() {
    this.isModalOpen.set(false);
    this.isEditing.set(false);
    this.editingId.set(null);
  }

  onSave(addAnother: boolean = false) {
    if (!this.questionForm.text.trim()) {
      this.showStatus('يرجى كتابة نص السؤال', 'error');
      return;
    }

    this.isSaving.set(true);
    
    // Prepare the full list for synchronization
    let allQuestions = this.questions().map(q => ({
      id: q.id,
      text: q.text,
      choices: q.choices,
      correctIndex: q.correctIndex,
      points: Number(q.points) || 1,
      explanation: q.explanation,
      choiceExplanations: q.choiceExplanations,
      imageUrl: q.imageUrl
    }));

    const newQ = this.questionForm;
    const formattedQ = {
      text: newQ.text,
      choices: newQ.type === 'mcq' ? [...newQ.options] : ['صح', 'خطأ'],
      correctIndex: newQ.type === 'mcq' ? newQ.correctIndex : (newQ.isTrue ? 0 : 1),
      points: Number(newQ.points) || 1,
      explanation: null,
      choiceExplanations: null,
      imageUrl: null
    };

    if (this.isEditing()) {
      const idx = allQuestions.findIndex(q => q.id === this.editingId());
      if (idx !== -1) {
        allQuestions[idx] = { ...allQuestions[idx], ...formattedQ };
      }
    } else {
      allQuestions.push(formattedQ as any);
    }

    // Clean for backend bulk-save (expects { questions: [...] } without IDs)
    const payload = { 
      questions: allQuestions.map(q => {
        const { id, ...rest } = q;
        return rest;
      }) 
    };
    
    this.examService.addQuestion(this.examId, payload).subscribe({
      next: () => {
        this.loadQuestions();
        setTimeout(() => {
          this.isSaving.set(false);
          this.showStatus(this.isEditing() ? 'تم تحديث السؤال بنجاح' : 'تم إضافة السؤال بنجاح', 'success');
          if (addAnother) {
            this.resetForm();
          } else {
            this.closeModal();
          }
        }, 500);
      },
      error: (err) => {
        this.isSaving.set(false);
        this.showStatus(err.error?.message || 'فشل حفظ السؤال', 'error');
      }
    });
  }

  onDelete(qId: number) {
    this.idToDelete.set(qId);
    this.isDeleteModalOpen.set(true);
  }

  closeDeleteModal() {
    this.isDeleteModalOpen.set(false);
    this.idToDelete.set(null);
  }

  confirmDelete() {
    const qId = this.idToDelete();
    if (!qId) return;

    // Filter out the question locally
    const filteredQuestions = this.questions()
      .filter(q => q.id !== qId)
      .map(q => ({
        text: q.text,
        choices: q.choices,
        correctIndex: q.correctIndex,
        points: Number(q.points) || 1,
        explanation: q.explanation,
        choiceExplanations: q.choiceExplanations,
        imageUrl: q.imageUrl
      }));

    this.examService.addQuestion(this.examId, { questions: filteredQuestions }).subscribe({
      next: () => {
        this.showStatus('تم حذف السؤال بنجاح', 'success');
        this.loadQuestions();
        this.closeDeleteModal();
      },
      error: (err) => {
        this.showStatus(err.error?.message || 'فشل حذف السؤال', 'error');
        this.closeDeleteModal();
      }
    });
  }
}
