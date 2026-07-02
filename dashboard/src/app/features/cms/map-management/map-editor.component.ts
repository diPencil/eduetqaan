import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MapService, MapBank, MapItem } from '../../../core/services/map.service';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { finalize } from 'rxjs';

@Component({
  selector: 'app-map-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent, RouterLink],
  templateUrl: './map-editor.component.html',
})
export class MapEditorComponent implements OnInit {
  private service = inject(MapService);
  private route = inject(ActivatedRoute);
  
  bankId = signal<number | null>(null);
  bank = signal<MapBank | null>(null);
  items = signal<MapItem[]>([]);
  
  isLoading = signal(false);
  isSaving = signal(false);
  
  showModal = signal(false);
  isEditing = signal(false);
  editingItemId: number | null = null;
  formData: Partial<MapItem> = {
    markerNumber: 1,
    prompt: '',
    answerText: '',
    status: 'published',
    orderIndex: 1
  };

  ngOnInit() {
    this.route.params.subscribe(params => {
      const id = Number(params['id']);
      if (id) {
        this.bankId.set(id);
        this.loadDetails();
      }
    });
  }

  loadDetails() {
    if (!this.bankId()) return;
    this.isLoading.set(true);
    this.service.getBank(this.bankId()!)
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe((res: any) => {
        if (res.success) {
          this.bank.set(res.data.bank);
          this.items.set(res.data.items);
        }
      });
  }

  openAddModal() {
    this.isEditing.set(false);
    this.editingItemId = null;
    this.formData = {
      markerNumber: this.items().length > 0 ? Math.max(...this.items().map(i => i.markerNumber)) + 1 : 1,
      prompt: '',
      answerText: '',
      status: 'published',
      orderIndex: (this.items().length + 1)
    };
    this.showModal.set(true);
  }

  openEditModal(item: MapItem) {
    this.isEditing.set(true);
    this.editingItemId = item.id;
    this.formData = { ...item };
    this.showModal.set(true);
  }

  onSave() {
    if (!this.formData.markerNumber || !this.formData.prompt) return;
    this.isSaving.set(true);

    const action = this.isEditing() 
      ? this.service.updateItem(this.bankId()!, this.editingItemId!, this.formData)
      : this.service.createItem(this.bankId()!, this.formData);

    action.pipe(finalize(() => this.isSaving.set(false)))
      .subscribe((res: any) => {
        if (res.success) {
          this.loadDetails();
          this.showModal.set(false);
        }
      });
  }

  onDelete(itemId: number) {
    if (!confirm('هل أنت متأكد من حذف هذه النقطة؟')) return;
    this.service.deleteItem(this.bankId()!, itemId).subscribe(() => this.loadDetails());
  }
}
