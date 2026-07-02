import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CommunityService, CommunityQuestion, CommunityAnswer, Attachment } from '../../../core/services/community.service';

import { IconComponent } from '../../../shared/components/icon/icon.component';

@Component({
  selector: 'app-question-thread',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, IconComponent],
  templateUrl: './question-thread.component.html',
})
export class QuestionThreadComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private communityService = inject(CommunityService);

  questionId = 0;
  question = signal<CommunityQuestion | null>(null);
  answers = signal<CommunityAnswer[]>([]);
  isLoading = signal(true);
  isSaving = signal(false);

  replyText = '';
  resources = signal<any[]>([]);
  newResource = { kind: 'link', title: '', url: '' };

  ngOnInit() {
    this.route.params.subscribe(params => {
      this.questionId = +params['id'];
      this.loadThread();
    });
  }

  loadThread() {
    this.isLoading.set(true);
    this.communityService.getQuestionDetails(this.questionId).subscribe({
      next: (res) => {
        this.question.set(res.data.question);
        this.answers.set(res.data.answers);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false)
    });
  }

  onPostAnswer() {
    this.isSaving.set(true);
    const payload: any = {
      contentText: this.replyText,
      attachments: this.resources().map(r => ({
        kind: r.kind,
        url: r.url,
        title: r.title,
        mime: this.getMime(r.kind)
      }))
    };

    this.communityService.addAnswer(this.questionId, payload).subscribe({
      next: () => {
        this.loadThread();
        this.replyText = '';
        this.resources.set([]);
        this.isSaving.set(false);
      },
      error: () => this.isSaving.set(false)
    });
  }

  addResource() {
    if (this.newResource.title && this.newResource.url) {
      this.resources.update(prev => [...prev, { ...this.newResource }]);
      this.newResource = { kind: 'link', title: '', url: '' };
    }
  }

  removeResource(index: number) {
    this.resources.update(prev => prev.filter((_, i) => i !== index));
  }

  getResourceIcon(kind: string): string {
    switch (kind) {
      case 'pdf': return 'file-text';
      case 'video':
      case 'mp4': return 'video';
      case 'image': return 'image';
      default: return 'link';
    }
  }

  getResourceLabel(kind: string): string {
    switch (kind) {
      case 'pdf': return 'ملزمة PDF';
      case 'video':
      case 'mp4': return 'فيديو توضيحي';
      case 'image': return 'صورة توضيحية';
      default: return 'رابط خارجي';
    }
  }

  getMime(kind: string): string {
    switch (kind) {
      case 'pdf': return 'application/pdf';
      case 'video':
      case 'mp4': return 'video/mp4';
      case 'image': return 'image/jpeg';
      default: return 'text/html';
    }
  }

  onStatusChange(newStatus: string) {
    this.communityService.updateStatus(this.questionId, newStatus).subscribe(() => {
      this.loadThread();
    });
  }

  onDelete() {
    if (confirm('هل أنت متأكد من حذف هذا السؤال نهائياً من المجتمع؟')) {
       this.communityService.deleteQuestion(this.questionId).subscribe(() => {
          // Go back
          window.history.back();
       });
    }
  }
}
