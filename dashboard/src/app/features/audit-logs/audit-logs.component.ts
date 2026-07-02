import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuditService } from '../../core/services/audit.service';
import { AuditLog, AuditAction, AuditEntityType, AuditLogFilters } from '../../core/models/audit.model';
import { TableComponent } from '../../shared/components/table/table.component';
import { FilterBarComponent, FilterDefinition } from '../../shared/components/filter-bar/filter-bar.component';
import { HeaderComponent } from '../../shared/components/header/header.component';

@Component({
  selector: 'app-audit-logs',
  standalone: true,
  imports: [CommonModule, FormsModule, TableComponent, FilterBarComponent, HeaderComponent],
  template: `
    <div class="space-y-6 pb-20 font-sans" dir="rtl">
      <app-header 
        title="سجل حركات النظام (Audit Logs)" 
        subtitle="تتبع ومراقبة كافة الإجراءات الحساسة التي تمت على النظام">
      </app-header>

      <app-filter-bar
        [filters]="filterDefs"
        searchPlaceholder="ابحث باسم المستخدم أو التفاصيل..."
        (search)="onSearch($event)"
        (filterChange)="onFilterChange($event)">
        <div actions>
          <button (click)="exportCSV()" class="bg-indigo-50 text-indigo-600 border border-indigo-100 px-6 py-3 rounded-2xl font-black text-sm hover:bg-indigo-600 hover:text-white transition-all shadow-sm">
            تصدير CSV 📥
          </button>
        </div>
      </app-filter-bar>

      <app-table
        [data]="logs()"
        [columns]="columns"
        [loading]="loading()"
        [total]="total()"
        [page]="filters().page!"
        [limit]="filters().limit!"
        (pageChange)="onPageChange($event)">
        
        <ng-template #rowTemplate let-log>
          <td class="px-6 py-4">
            <div class="flex flex-col">
              <span class="font-bold text-slate-800 text-sm">{{ log.userName }}</span>
              <span class="text-[10px] text-slate-400 font-black uppercase">{{ log.userRole }}</span>
            </div>
          </td>
          <td class="px-6 py-4 text-center">
            <span [ngClass]="getActionColor(log.action)" class="px-2.5 py-1 rounded-lg text-[9px] font-black border uppercase tracking-widest">
              {{ log.action }}
            </span>
          </td>
          <td class="px-6 py-4 text-center">
            <span class="text-xs font-black text-slate-600 bg-slate-50 px-2 py-1 rounded border border-slate-100">
              {{ log.entityType }}
            </span>
          </td>
          <td class="px-6 py-4">
            <p class="text-xs font-bold text-slate-700">{{ log.details }}</p>
            <p *ngIf="log.entityName" class="text-[10px] text-slate-400 mt-1 italic">{{ log.entityName }} (#{{ log.entityId }})</p>
          </td>
          <td class="px-6 py-4 text-center">
            <div class="flex flex-col text-xs text-slate-500 font-mono">
              <span class="font-bold">{{ log.createdAt | date:'yyyy/MM/dd' }}</span>
              <span class="text-[9px]">{{ log.createdAt | date:'hh:mm a' }}</span>
            </div>
          </td>
        </ng-template>
      </app-table>
    </div>
  `
})
export class AuditLogsComponent implements OnInit {
  private auditService = inject(AuditService);

  logs = signal<AuditLog[]>([]);
  total = signal(0);
  loading = signal(false);

  filters = signal<AuditLogFilters>({
    page: 1,
    limit: 15
  });

  columns = [
    { key: 'user', label: 'المستخدم' },
    { key: 'action', label: 'الإجراء', align: 'center' as const },
    { key: 'entity', label: 'الكيان', align: 'center' as const },
    { key: 'details', label: 'التفاصيل' },
    { key: 'date', label: 'التاريخ والوقت', align: 'center' as const }
  ];

  filterDefs: FilterDefinition[] = [
    {
      key: 'action',
      label: 'نوع الإجراء',
      value: null,
      options: Object.values(AuditAction).map(a => ({ value: a, label: a }))
    },
    {
      key: 'entityType',
      label: 'نوع الكيان',
      value: null,
      options: Object.values(AuditEntityType).map(e => ({ value: e, label: e }))
    }
  ];

  ngOnInit() {
    this.loadLogs();
  }

  loadLogs() {
    this.loading.set(true);
    this.auditService.getLogs(this.filters()).subscribe({
      next: (res) => {
        this.logs.set(res.data);
        this.total.set(res.total);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  onSearch(term: string) {
    this.filters.update(f => ({ ...f, searchTerm: term, page: 1 }));
    this.loadLogs();
  }

  onFilterChange(values: any) {
    this.filters.update(f => ({ ...f, ...values, page: 1 }));
    this.loadLogs();
  }

  onPageChange(page: number) {
    this.filters.update(f => ({ ...f, page }));
    this.loadLogs();
  }

  exportCSV() {
    // Generate simple CSV
    const headers = ['المستخدم', 'الدور', 'الإجراء', 'الكيان', 'تفاصيل', 'التاريخ'];
    const rows = this.logs().map(l => [
      l.userName,
      l.userRole,
      l.action,
      l.entityType,
      l.details.replace(/,/g, '،'), // prevent csv break
      new Date(l.createdAt).toLocaleString('ar-EG')
    ]);
    
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
      + headers.join(',') + '\n' 
      + rows.map(e => e.join(',')).join('\n');
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `audit-logs-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  getActionColor(action: AuditAction): string {
    switch(action) {
      case AuditAction.CREATE: return 'bg-emerald-50 text-emerald-600 border-emerald-100';
      case AuditAction.UPDATE: return 'bg-blue-50 text-blue-600 border-blue-100';
      case AuditAction.DELETE: return 'bg-red-50 text-red-600 border-red-100';
      case AuditAction.PAYMENT: return 'bg-amber-50 text-amber-600 border-amber-100';
      case AuditAction.LOGIN: return 'bg-teal-50 text-teal-600 border-teal-100';
      case AuditAction.ATTEND: return 'bg-indigo-50 text-indigo-600 border-indigo-100';
      default: return 'bg-slate-50 text-slate-600 border-slate-100';
    }
  }
}
