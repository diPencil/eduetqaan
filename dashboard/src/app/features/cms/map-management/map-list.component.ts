import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MapService, MapBank } from '../../../core/services/map.service';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { finalize } from 'rxjs';

@Component({
  selector: 'app-map-list',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent, RouterLink],
  templateUrl: './map-list.component.html',

  styles: [`:host { display: block; }`]
})
export class MapListComponent implements OnInit {
  private service = inject(MapService);
  
  banks = signal<MapBank[]>([]);
  isLoading = signal(false);
  isSaving = signal(false);
  
  searchQuery = '';
  filterLevel = '';
  
  showModal = signal(false);
  isEditing = signal(false);
  editingId: number | null = null;
  selectedFile: File | null = null;

  formData: Partial<MapBank> = {
    title: '',
    level: 'sec3',
    status: 'published',
    orderIndex: 1,
    mapImageUrl: ''
  };

  publishedCount = computed(() => this.banks().filter(b => b.status === 'published').length);
  draftCount = computed(() => this.banks().filter(b => b.status === 'draft').length);

  ngOnInit() {
    this.loadBanks();
  }

  loadBanks() {
    this.isLoading.set(true);
    const params: any = {};
    if (this.searchQuery) params.q = this.searchQuery;
    if (this.filterLevel) params.level = this.filterLevel;

    this.service.getBanks(params)
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe((res: any) => {
        if (res.success) {
          this.banks.set(res.data);
        }
      });
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.selectedFile = file;
    }
  }

  openAddModal() {
    this.isEditing.set(false);
    this.editingId = null;
    this.selectedFile = null;
    this.formData = {
      title: '',
      level: 'sec3',
      status: 'published',
      orderIndex: (this.banks().length + 1)
    };
    this.showModal.set(true);
  }

  openEditModal(bank: MapBank) {
    this.isEditing.set(true);
    this.editingId = bank.id;
    this.formData = { ...bank };
    this.showModal.set(true);
  }

  onSave() {
    if (!this.formData.title) return;
    this.isSaving.set(true);

    if (this.isEditing()) {
      this.service.updateBank(this.editingId!, this.formData)
        .pipe(finalize(() => this.isSaving.set(false)))
        .subscribe((res: any) => {
          if (res.success) {
            this.loadBanks();
            this.showModal.set(false);
          }
        });
    } else {
      const fData = new FormData();
      fData.append('title', this.formData.title!);
      fData.append('level', this.formData.level!);
      fData.append('status', this.formData.status!);
      fData.append('orderIndex', String(this.formData.orderIndex));
      if (this.selectedFile) {
        fData.append('file', this.selectedFile);
      }

      this.service.createBank(fData)
        .pipe(finalize(() => this.isSaving.set(false)))
        .subscribe((res: any) => {
          if (res.success) {
            this.loadBanks();
            this.showModal.set(false);
          }
        });
    }
  }

  onDelete(id: number) {
    if (!confirm('هل أنت متأكد من حذف هذا البنك بالكامل؟ سيتم حذف جميع النقاط المرتبطة به.')) return;
    this.service.deleteBank(id).subscribe(() => this.loadBanks());
  }
}
