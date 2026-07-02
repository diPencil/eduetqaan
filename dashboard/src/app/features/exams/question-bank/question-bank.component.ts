import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ExamService } from '../../../core/services/exam.service';
import { Router } from '@angular/router';
import { IconComponent } from '../../../shared/components/icon/icon.component';

@Component({
  selector: 'app-question-bank',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: './question-bank.component.html',

  styles: [`
    :host { display: block; }
  `]
})
export class QuestionBankComponent implements OnInit {
  private examService = inject(ExamService);
  private router = inject(Router);

  questions = signal<any[]>([]);
  loading = signal(true);
  
  searchQuery = '';
  selectedGrade = '';
  selectedExam = '';

  ngOnInit() {
    this.loadQuestions();
  }

  loadQuestions() {
    this.loading.set(true);
    this.examService.getAllQuestions().subscribe({
      next: (res) => {
        this.questions.set(res.data || []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  uniqueExams = computed(() => {
    const map = new Map();
    this.questions().forEach(q => {
      if (!map.has(q.examId)) {
        map.set(q.examId, { id: q.examId, title: q.examTitle });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.title.localeCompare(b.title));
  });

  filteredQuestions = computed(() => {
    const q = this.searchQuery.toLowerCase();
    const g = this.selectedGrade;
    const ex = this.selectedExam;

    return this.questions().filter(item => {
      const matchText = !q || item.text.toLowerCase().includes(q);
      const matchGrade = !g || item.grade === g;
      const matchExam = !ex || item.examId === Number(ex);
      return matchText && matchGrade && matchExam;
    });
  });

  onFilterChange() {
    // Computed values handle this automatically
  }

  resetFilters() {
    this.searchQuery = '';
    this.selectedGrade = '';
    this.selectedExam = '';
  }

  editQuestion(q: any) {
    this.router.navigate(['/exams', q.examId, 'questions']);
  }

  viewExamReport(examId: number) {
    this.router.navigate(['/exams', examId, 'report']);
  }
}
