import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GamificationService, GamificationSettings } from '../../core/services/gamification.service';
import { IconComponent } from '../../shared/components/icon/icon.component';

@Component({
  selector: 'app-gamification',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './gamification.component.html'
})
export class GamificationComponent implements OnInit {
  private gamificationService = inject(GamificationService);

  settings = signal<GamificationSettings | null>(null);
  isLoading = signal(true);
  isSaving = signal(false);

  // Status Modal
  statusModal = signal(false);
  statusMessage = signal('');
  statusType = signal<'success' | 'error'>('success');

  ngOnInit() {
    this.loadSettings();
  }

  loadSettings() {
    this.isLoading.set(true);
    this.gamificationService.getSettings().subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.settings.set({ ...res.data });
        }
        this.isLoading.set(false);
      },
      error: () => {
        this.showStatus('فشل تحميل إعدادات المكافآت', 'error');
        this.isLoading.set(false);
      }
    });
  }

  saveSettings() {
    const currentSettings = this.settings();
    if (!currentSettings) return;

    this.isSaving.set(true);
    this.gamificationService.updateSettings(currentSettings).subscribe({
      next: (res) => {
        if (res.success) {
          this.showStatus('تم حفظ إعدادات المكافآت بنجاح', 'success');
          this.settings.set({ ...res.data });
        }
        this.isSaving.set(false);
      },
      error: () => {
        this.showStatus('فشل حفظ الإعدادات', 'error');
        this.isSaving.set(false);
      }
    });
  }

  showStatus(msg: string, type: 'success' | 'error') {
    this.statusMessage.set(msg);
    this.statusType.set(type);
    this.statusModal.set(true);
    setTimeout(() => this.statusModal.set(false), 3000);
  }
}
