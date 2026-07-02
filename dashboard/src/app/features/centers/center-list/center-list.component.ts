import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { CenterService, Center } from '../../../core/services/center.service';
import { EGYPT_GOVERNORATES } from '../../../core/constants/locations';
import { finalize } from 'rxjs';
import { IconComponent } from '../../../shared/components/icon/icon.component';

@Component({
  selector: 'app-center-list',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, IconComponent, RouterModule],
  templateUrl: './center-list.component.html',

  styles: [`
    :host { display: block; }
    .animate-in { animation: fadeIn 0.5s ease-out; }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `]
})
export class CenterListComponent implements OnInit {
  private centerService = inject(CenterService);
  private fb = inject(FormBuilder);

  centers = signal<Center[]>([]);
  isLoading = signal(true);
  isModalOpen = signal(false);
  isEditing = signal(false);
  isSaving = signal(false);
  selectedCenterId = signal<number | null>(null);

  governorates = EGYPT_GOVERNORATES;
  centerForm: FormGroup;

  constructor() {
    this.centerForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3)]],
      region: ['', [Validators.required]],
      city: [''],
      addressLine: ['', [Validators.required, Validators.minLength(5)]],
      mapsUrl: ['', [Validators.pattern('https?://.*')]],
      isActive: [true]
    });
  }

  ngOnInit(): void {
    this.loadCenters();
  }

  loadCenters(): void {
    this.isLoading.set(true);
    this.centerService.getCenters({ withStats: true })
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: (res) => {
          if (res.success) {
            this.centers.set(res.data);
          }
        },
        error: (err) => console.error('Error loading centers:', err)
      });
  }

  activeCentersCount(): number {
    return this.centers().filter(c => c.isActive).length;
  }

  totalStudentsCount(): number {
    return this.centers().reduce((acc, c) => acc + (c.studentCount || 0), 0);
  }

  openModal(center?: Center): void {
    if (center) {
      this.isEditing.set(true);
      this.selectedCenterId.set(center.id);
      this.centerForm.patchValue(center);
    } else {
      this.isEditing.set(false);
      this.selectedCenterId.set(null);
      this.centerForm.reset({ isActive: true, region: '' });
    }
    this.isModalOpen.set(true);
  }

  closeModal(): void {
    this.isModalOpen.set(false);
  }

  // Premium Feedback Modals
  statusModal = signal(false);
  statusMessage = signal('');
  statusType = signal<'success' | 'error'>('success');

  isDeleteModalOpen = signal(false);
  centerToDelete = signal<Center | null>(null);

  showStatus(msg: string, type: 'success' | 'error' = 'success') {
    this.statusMessage.set(msg);
    this.statusType.set(type);
    this.statusModal.set(true);
    setTimeout(() => this.statusModal.set(false), 3000);
  }

  saveCenter(): void {
    if (this.centerForm.invalid) return;

    this.isSaving.set(true);
    const data = this.centerForm.value;

    if (this.isEditing() && this.selectedCenterId()) {
      this.centerService.updateCenter(this.selectedCenterId()!, data)
        .pipe(finalize(() => this.isSaving.set(false)))
        .subscribe({
          next: (res) => {
            if (res.success) {
              this.showStatus('تم تحديث السنتر بنجاح', 'success');
              this.loadCenters();
              this.closeModal();
            }
          },
          error: (err) => this.showStatus('حدث خطأ أثناء التحديث', 'error')
        });
    } else {
      this.centerService.createCenter(data)
        .pipe(finalize(() => this.isSaving.set(false)))
        .subscribe({
          next: (res) => {
            if (res.success) {
              this.showStatus('تم إضافة السنتر بنجاح', 'success');
              this.loadCenters();
              this.closeModal();
            }
          },
          error: (err) => this.showStatus('حدث خطأ أثناء الإضافة', 'error')
        });
    }
  }

  deleteCenter(center: Center): void {
    this.centerToDelete.set(center);
    this.isDeleteModalOpen.set(true);
  }

  closeDeleteModal(): void {
    this.isDeleteModalOpen.set(false);
    this.centerToDelete.set(null);
  }

  confirmDelete(): void {
    const center = this.centerToDelete();
    if (!center) return;

    this.centerService.deleteCenter(center.id).subscribe({
      next: (res) => {
        if (res.success) {
          this.showStatus('تم حذف السنتر بنجاح', 'success');
          this.loadCenters();
          this.closeDeleteModal();
        }
      },
      error: (err) => {
        this.showStatus('حدث خطأ أثناء الحذف', 'error');
        this.closeDeleteModal();
      }
    });
  }
}
