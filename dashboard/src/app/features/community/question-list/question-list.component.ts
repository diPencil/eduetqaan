import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CommunityService, CommunityQuestion } from '../../../core/services/community.service';

import { IconComponent } from '../../../shared/components/icon/icon.component';

@Component({
  selector: 'app-question-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, IconComponent],
  templateUrl: './question-list.component.html',

  styles: [`
    .line-clamp-3 {
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
  `]
})
export class QuestionListComponent implements OnInit {
  private communityService = inject(CommunityService);

  questions = signal<CommunityQuestion[]>([]);
  totalQuestions = signal(0);
  isLoading = signal(true);

  searchQuery = '';
  statusFilter = 'open'; // Default to show open questions

  ngOnInit() {
    this.loadQuestions();
  }

  loadQuestions() {
    this.isLoading.set(true);
    const params: any = {
      page: 1,
      limit: 20
    };
    if (this.searchQuery) params.q = this.searchQuery;
    if (this.statusFilter) params.status = this.statusFilter;

    this.communityService.getQuestions(params).subscribe({
      next: (res) => {
        this.questions.set(res.data);
        this.totalQuestions.set(res.pagination.total);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false)
    });
  }
}
