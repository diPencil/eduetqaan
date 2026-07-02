import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LiveRequestService, LiveRequest } from '../../core/services/live-request.service';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { finalize } from 'rxjs';

@Component({
  selector: 'app-live-request-list',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: './live-request-list.component.html',

  styles: [`
    :host { display: block; }
  `]
})
export class LiveRequestListComponent implements OnInit {
  private service = inject(LiveRequestService);
  
  requests = signal<LiveRequest[]>([]);
  isLoading = signal(false);
  isSaving = signal(false);
  
  searchPhone = '';
  filterStatus = '';
  
  // Modal State
  showModal = signal(false);
  selectedRequest = signal<LiveRequest | null>(null);
  modalData = {
    status: '',
    scheduledAt: '',
    notes: '',
    meetLink: ''
  };

  // Computed Stats
  pendingCount = computed(() => this.requests().filter(r => r.status === 'new').length);
  scheduledCount = computed(() => this.requests().filter(r => !!r.scheduledAt).length);
  ignoredCount = computed(() => this.requests().filter(r => r.status === 'ignored').length);

  ngOnInit() {
    this.loadRequests();
  }

  loadRequests() {
    this.isLoading.set(true);
    const params: any = {};
    if (this.filterStatus) params.status = this.filterStatus;
    if (this.searchPhone) params.phone = this.searchPhone;

    this.service.getLiveRequests(params)
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe((res: any) => {
        if (res.success) {
          this.requests.set(res.data);
        }
      });
  }

  openEditModal(req: LiveRequest) {
    this.selectedRequest.set(req);
    this.modalData = {
      status: req.status,
      scheduledAt: req.scheduledAt ? new Date(req.scheduledAt).toISOString().slice(0, 16) : '',
      notes: req.note || '',
      meetLink: req.meetLink || ''
    };
    this.showModal.set(true);
  }

  saveChanges() {
    const id = this.selectedRequest()?.id;
    if (!id) return;
    
    this.isSaving.set(true);
    const data: any = {
      status: this.modalData.status,
      notes: this.modalData.notes,
      scheduledAt: this.modalData.scheduledAt || null,
      meetLink: this.modalData.meetLink || null
    };

    this.service.updateLiveRequest(id, data)
      .pipe(finalize(() => this.isSaving.set(false)))
      .subscribe((res: any) => {
        if (res.success) {
          this.loadRequests();
          this.showModal.set(false);
        }
      });
  }

  updateStatus(id: number, status: any) {
    if (status === 'ignored' && !confirm('هل أنت متأكد من تجاهل هذا الطلب؟')) return;
    
    this.service.updateLiveRequest(id, { status })
      .subscribe((res: any) => {
        if (res.success) {
          this.loadRequests();
        }
      });
  }
}
