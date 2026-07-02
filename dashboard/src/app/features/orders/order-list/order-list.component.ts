import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OrderService } from '../../../core/services/order.service';
import { IconComponent } from '../../../shared/components/icon/icon.component';

@Component({
  selector: 'app-order-list',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: './order-list.component.html',
})
export class OrderListComponent {
  private orderService = inject(OrderService);
  
  orders = signal<any[]>([]);
  isLoading = signal(false);
  activeTab: 'manual' | 'topup' = 'manual';
  selectedStatus = 'pending';
  searchQuery = '';
  selectedProof: string | null = null;

  constructor() {
    this.loadOrders();
  }

  loadOrders() {
    this.isLoading.set(true);
    if (this.activeTab === 'manual') {
      const params = {
        status: this.selectedStatus === 'all' ? 'all' : this.selectedStatus,
        search: this.searchQuery || undefined
      };
      this.orderService.getManualOrders(params).subscribe({
        next: (res) => {
          const data = Array.isArray(res.data) ? res.data : (res.data?.rows || []);
          this.orders.set(data);
          this.isLoading.set(false);
        },
        error: () => this.isLoading.set(false)
      });
    } else {
      this.orderService.getTopups().subscribe({
        next: (res) => {
          // Filter topups locally since backend filter might be missing
          const dataFromRes = Array.isArray(res.data) ? res.data : (res.data as any)?.rows || [];
          let data = [...dataFromRes];
          if (this.selectedStatus !== 'all') {
            data = data.filter((d: any) => d.status === this.selectedStatus);
          }
          if (this.searchQuery) {
            const q = this.searchQuery.toLowerCase();
            data = data.filter((d: any) => 
               String(d.id).includes(q) || 
               (d.studentName && d.studentName.toLowerCase().includes(q))
            );
          }
          this.orders.set(data);
          this.isLoading.set(false);
        },
        error: () => this.isLoading.set(false)
      });
    }
  }

  onApprove(id: number) {
    if (confirm('هل أنت متأكد من الموافقة على هذا الطلب؟')) {
      const sub = this.activeTab === 'manual' 
        ? this.orderService.confirmManualOrder(id) 
        : this.orderService.approveTopup(id);
      
      sub.subscribe(() => this.loadOrders());
    }
  }

  onReject(id: number) {
    const reason = prompt('سبب الرفض (اختياري):');
    if (reason !== null) {
      const sub = this.activeTab === 'manual'
        ? this.orderService.rejectManualOrder(id)
        : this.orderService.rejectTopup(id, reason);
      
      sub.subscribe(() => this.loadOrders());
    }
  }

  get currentTabChanged() {
    return this.activeTab;
  }
}
