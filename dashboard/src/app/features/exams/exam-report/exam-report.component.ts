import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ExamService } from '../../../core/services/exam.service';
import { finalize } from 'rxjs';
import { IconComponent } from '../../../shared/components/icon/icon.component';

@Component({
  selector: 'app-exam-report',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, IconComponent],
  templateUrl: './exam-report.component.html',

  styles: [`
    :host { display: block; background-color: #fcfcfd; min-height: 100vh; }
  `]
})
export class ExamReportComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private examService = inject(ExamService);

  exam = signal<any>(null);
  results = signal<any[]>([]);
  searchQuery = signal('');
  performanceFilter = signal('');
  isLoading = signal(false);

  filteredResults = computed(() => {
    let list = this.results();
    const query = this.searchQuery().toLowerCase().trim();
    const perf = this.performanceFilter();

    if (query) {
      list = list.filter(r => 
        r.studentName.toLowerCase().includes(query) || 
        (r.studentCode && String(r.studentCode).includes(query))
      );
    }

    if (perf) {
      if (perf === 'high') list = list.filter(r => (r.score || 0) >= 85);
      else if (perf === 'mid') list = list.filter(r => (r.score || 0) >= 50 && (r.score || 0) < 85);
      else if (perf === 'low') list = list.filter(r => (r.score || 0) < 50);
    }

    return list.sort((a, b) => (b.score || 0) - (a.score || 0));
  });

  ngOnInit() {
    this.loadReport();
  }

  loadReport() {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!id) return;

    this.isLoading.set(true);
    this.examService.getExamReport(id)
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: (res) => {
          if (res.success) {
            this.exam.set(res.data.exam);
            this.results.set(res.data.results || []);
          }
        },
        error: (err) => console.error('Failed to load report', err)
      });
  }

  getHighScore(): number {
    if (!this.results().length) return 0;
    return Math.max(...this.results().map(r => r.score || 0));
  }

  getAverageScore(): string {
    if (!this.results().length) return '0';
    const sum = this.results().reduce((acc, curr) => acc + (curr.score || 0), 0);
    return (sum / this.results().length).toFixed(1);
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleString('ar-EG', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  exportToCsv() {
    const res = this.results();
    if (!res.length) return;

    let csv = 'اسم الطالب,الكود,الدرجة %,موبايل الطالب,موبايل ولي الأمر,وقت البدء,وقت التسليم\n';
    res.forEach(r => {
      csv += `${r.studentName},${r.studentCode},${r.score}%,${r.studentPhone},${r.guardianPhone},${this.formatDate(r.startedAt)},${this.formatDate(r.submittedAt)}\n`;
    });

    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `نتائج_${this.exam()?.title || 'امتحان'}.csv`;
    link.click();
  }
}
