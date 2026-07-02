import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { VoucherService, Voucher } from '../../../core/services/voucher.service';

import { IconComponent } from '../../../shared/components/icon/icon.component';

@Component({
  selector: 'app-voucher-list',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: './voucher-list.component.html',

  styles: [`
    .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
    .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
    .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
  `]
})
export class VoucherListComponent {
  private voucherService = inject(VoucherService);
  
  vouchers = signal<any[]>([]); 
  isLoading = signal(false);
  isSaving = signal(false);
  
  showGenerateModal = false;
  showManualModal = false;
  showEditModal = false;
  
  selectedVoucher: any = null;
  
  // Filters
  searchTerm = signal('');
  statusFilter = signal('all');

  genCount = 10;
  genAmount = 100;

  manualForm = { code: '', amount: 100 };
  editForm = { amount: 0, status: 'issued' };

  showExportModal = false;
  exportType = 'unused_today';
  exportValueFilter = 0;

  filteredVouchers = computed(() => {
    const term = this.searchTerm().toLowerCase().trim();
    const status = this.statusFilter();
    
    return this.vouchers().filter(v => {
      const matchesSearch = v.codeHash.toLowerCase().includes(term);
      const matchesStatus = status === 'all' ? true : 
                          status === 'used' ? v.isUsed : !v.isUsed;
      return matchesSearch && matchesStatus;
    });
  });

  constructor() {
    this.loadVouchers();
  }

  loadVouchers() {
    this.isLoading.set(true);
    this.voucherService.getVouchers().subscribe({
      next: (res) => {
        this.vouchers.set(res.data);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false)
    });
  }

  usedCount() {
    return this.vouchers().filter(v => v.isUsed).length;
  }
  
  availableCount() {
    return this.vouchers().filter(v => !v.isUsed).length;
  }

  onGenerate() {
    this.isSaving.set(true);
    this.voucherService.generateVouchers({
      count: this.genCount,
      amount: this.genAmount
    }).subscribe({
      next: () => {
        this.showGenerateModal = false;
        this.isSaving.set(false);
        this.loadVouchers();
      },
      error: () => this.isSaving.set(false)
    });
  }

  onManualIssue() {
    if (!this.manualForm.amount || this.manualForm.amount <= 0) return;
    this.isSaving.set(true);
    this.voucherService.issueVoucher(this.manualForm).subscribe({
      next: () => {
        this.showManualModal = false;
        this.isSaving.set(false);
        this.loadVouchers();
        this.manualForm = { code: '', amount: 100 };
      },
      error: (err) => {
        alert(err.error?.message || 'خطأ في إنشاء الكود');
        this.isSaving.set(false);
      }
    });
  }

  openEditModal(v: any) {
    this.selectedVoucher = v;
    this.editForm = {
      amount: v.amountCents / 100,
      status: v.status || (v.isUsed ? 'redeemed' : 'issued')
    };
    this.showEditModal = true;
  }

  onUpdate() {
    if (!this.selectedVoucher) return;
    this.isSaving.set(true);
    this.voucherService.updateVoucher(this.selectedVoucher.id, this.editForm).subscribe({
      next: () => {
        this.showEditModal = false;
        this.isSaving.set(false);
        this.loadVouchers();
      },
      error: (err) => {
        alert(err.error?.message || 'خطأ في تحديث البيانات');
        this.isSaving.set(false);
      }
    });
  }

  onDelete(id: number) {
    if (confirm('هل أنت متأكد من حذف هذا الكود؟')) {
      this.voucherService.deleteVoucher(id).subscribe(() => this.loadVouchers());
    }
  }

  openExportModal() {
    this.showExportModal = true;
    this.exportType = 'unused_today';
    this.exportValueFilter = 0;
  }

  getAvailableValues() {
    // Unique amountCents values converted to EGP
    const amounts = this.vouchers().map(v => v.amountCents / 100);
    return [...new Set(amounts)].sort((a, b) => a - b);
  }

  executeExport() {
    let dataToExport = [];
    const all = this.vouchers();
    
    if (this.exportType === 'current') {
      dataToExport = this.filteredVouchers();
    } else if (this.exportType === 'unused_today') {
      const todayStr = new Date().toDateString();
      dataToExport = all.filter(v => {
        if (v.isUsed || v.status === 'redeemed') return false;
        return new Date(v.createdAt).toDateString() === todayStr;
      });
    } else if (this.exportType === 'unused_all') {
      dataToExport = all.filter(v => !v.isUsed && v.status !== 'redeemed');
    }

    // Filter by value if specified
    if (this.exportValueFilter > 0) {
      dataToExport = dataToExport.filter(v => (v.amountCents / 100) === Number(this.exportValueFilter));
    }

    if (dataToExport.length === 0) {
      alert('لا يوجد بيانات مطابقة للخيارات المحددة لتصديرها.');
      return;
    }

    this.doCSVExport(dataToExport);
    this.showExportModal = false;
  }

  private doCSVExport(data: any[]) {
    const headers = ['الكود', 'القيمة (EGP)', 'الحالة', 'تاريخ الإنشاء'];
    const rows = data.map(v => [
      v.codeHash,
      v.amountCents / 100,
      (v.status === 'redeemed' || v.isUsed) ? 'مستخدمة' : 'متاحة',
      new Date(v.createdAt).toLocaleDateString('en-GB') // Output in DD/MM/YYYY
    ]);

    let csvContent = '\ufeff'; 
    csvContent += headers.join(',') + '\n';
    rows.forEach(row => {
      csvContent += row.map(cell => `"${cell}"`).join(',') + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `vouchers_export_${new Date().getTime()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
