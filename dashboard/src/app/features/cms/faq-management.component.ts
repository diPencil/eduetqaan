import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FaqService, FaqItem } from '../../core/services/faq.service';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { finalize } from 'rxjs';

@Component({
  selector: 'app-faq-management',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: './faq-management.component.html',
})
export class FaqManagementComponent implements OnInit {
  private service = inject(FaqService);
  
  faqs = signal<FaqItem[]>([]);
  isLoading = signal(false);
  isSaving = signal(false);
  
  searchQuery = '';
  filterCategory = '';
  
  showModal = signal(false);
  isEditing = signal(false);
  editingId: number | null = null;
  formData: Partial<FaqItem> = {
    questionText: '',
    answerText: '',
    category: 'general',
    status: 'published',
    orderIndex: 1
  };

  publishedCount = computed(() => this.faqs().filter(f => f.status === 'published').length);
  draftCount = computed(() => this.faqs().filter(f => f.status === 'draft').length);

  ngOnInit() {
    this.loadFaqs();
  }

  loadFaqs() {
    this.isLoading.set(true);
    const params: any = { all: 1, status: 'all' };
    if (this.searchQuery) params.q = this.searchQuery;
    if (this.filterCategory) params.category = this.filterCategory;

    this.service.getFaqs(params)
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe((res: any) => {
        if (res.success) {
          this.faqs.set(res.data);
        }
      });
  }

  openAddModal() {
    this.isEditing.set(false);
    this.editingId = null;
    this.formData = {
      questionText: '',
      answerText: '',
      category: 'general',
      status: 'published',
      orderIndex: (this.faqs().length + 1)
    };
    this.showModal.set(true);
  }

  openEditModal(faq: FaqItem) {
    this.isEditing.set(true);
    this.editingId = faq.id;
    this.formData = { ...faq };
    this.showModal.set(true);
  }

  onSave() {
    if (!this.formData.questionText) return;
    this.isSaving.set(true);

    const action = this.isEditing() 
      ? this.service.updateFaq(this.editingId!, this.formData)
      : this.service.createFaq(this.formData);

    action.pipe(finalize(() => this.isSaving.set(false)))
      .subscribe((res: any) => {
        if (res.success) {
          this.loadFaqs();
          this.showModal.set(false);
        }
      });
  }

  onDelete(id: number) {
    if (!confirm('هل أنت متأكد من حذف هذا السؤال؟')) return;
    this.service.deleteFaq(id).subscribe(() => this.loadFaqs());
  }
}
