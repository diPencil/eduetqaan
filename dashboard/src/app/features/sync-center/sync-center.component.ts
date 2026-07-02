import { Component, OnInit, OnDestroy, NgZone, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SyncService, SyncStats, OutboxRow, SyncLogEntry } from '../../core/services/sync.service';
import { interval, Subscription } from 'rxjs';
import { IconComponent } from '../../shared/components/icon/icon.component';

@Component({
  selector: 'app-sync-center',
  standalone: true,
  imports: [CommonModule, IconComponent],
  templateUrl: './sync-center.component.html',
  styleUrls: ['./sync-center.component.css']
})
export class SyncCenterComponent implements OnInit, OnDestroy {
  stats: SyncStats = { 
    PENDING: 0, FAILED: 0, COMPLETED: 0, 
    totalLogs: 0, successLogs: 0, failedLogs: 0 
  };
  failedRows: OutboxRow[] = [];
  logs: SyncLogEntry[] = [];
  loading = false;
  reprocessing = false;
  activeTab: 'outbox' | 'history' = 'outbox';
  now = new Date();
  
  private refreshSub?: Subscription;

  constructor(
    private syncService: SyncService,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.refresh();
    // Run status check outside Angular to prevent endless Change Detection loops
    this.ngZone.runOutsideAngular(() => {
      this.refreshSub = interval(15000).subscribe(() => {
        this.ngZone.run(() => this.getStats());
      });
    });
  }

  ngOnDestroy() {
    this.refreshSub?.unsubscribe();
  }

  setTab(tab: 'outbox' | 'history') {
    this.activeTab = tab;
    if (tab === 'history') {
      this.getReports();
    } else {
      this.getFailedRows();
    }
  }

  refresh() {
    this.loading = true;
    this.getStats();
    if (this.activeTab === 'outbox') {
      this.getFailedRows();
    } else {
      this.getReports();
    }
  }

  getStats() {
    this.syncService.getStats().subscribe({
      next: (res) => {
        if (res.success) {
          this.stats = res.stats;
          this.cdr.detectChanges();
        }
      },
      error: (err) => {
        console.error('Error fetching stats:', err);
        this.loading = false;
      },
      complete: () => {
        this.loading = false;
        this.now = new Date();
        this.cdr.detectChanges();
      }
    });
  }

  getReports() {
    this.loading = true;
    this.syncService.getReports({ limit: 50 }).subscribe({
      next: (res) => {
        console.log('[SyncCenter] Reports received:', res);
        if (res.success) {
          this.logs = res.rows || [];
          console.log('[SyncCenter] Logs updated, count:', this.logs.length);
        }
      },
      error: (err) => {
        console.error('[SyncCenter] Error fetching reports:', err);
        setTimeout(() => { this.loading = false; this.cdr.detectChanges(); });
      },
      complete: () => {
        setTimeout(() => { this.loading = false; this.cdr.detectChanges(); });
      }
    });
  }

  clearLogs() {
    if (confirm('هل أنت متأكد من مسح كافة سجلات المزامنة؟')) {
      this.syncService.clearReports().subscribe(() => this.refresh());
    }
  }

  getFailedRows() {
    this.loading = true;
    this.syncService.getOutbox('FAILED').subscribe({
      next: (res) => {
        console.log('[SyncCenter] Failed rows received:', res);
        if (res.success) {
          this.failedRows = res.rows || [];
        }
      },
      error: (err) => {
        console.error('[SyncCenter] Error fetching failed rows:', err);
        setTimeout(() => { this.loading = false; this.cdr.detectChanges(); });
      },
      complete: () => {
        setTimeout(() => { this.loading = false; this.cdr.detectChanges(); });
      }
    });
  }

  reprocessAll() {
    this.reprocessing = true;
    this.syncService.reprocess().subscribe({
      next: () => {
        this.refresh();
        setTimeout(() => this.reprocessing = false, 2000);
      },
      error: () => this.reprocessing = false
    });
  }

  reprocessSingle(id: number) {
    this.syncService.reprocess(id).subscribe(() => this.refresh());
  }

  pullManual() {
    this.loading = true;
    this.syncService.pullManual().subscribe(() => this.refresh());
  }

  downloadSql() {
    this.syncService.exportSql().subscribe(blob => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `recovery_${new Date().getTime()}.sql`;
      a.click();
      window.URL.revokeObjectURL(url);
    });
  }

  getStatusClass(status: string) {
    switch (status) {
      case 'PENDING': return 'bg-amber-100 text-amber-700';
      case 'FAILED': return 'bg-red-100 text-red-700';
      case 'COMPLETED': 
      case 'SUCCESS': return 'bg-emerald-100 text-emerald-700';
      case 'WARNING': return 'bg-orange-100 text-orange-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  }
}
