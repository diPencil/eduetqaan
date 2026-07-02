import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { NotificationService, AdminNotification, AdminNotificationBatch } from '../../../core/services/notification.service';
import { CenterService, Center } from '../../../core/services/center.service';
import { finalize } from 'rxjs';

@Component({
  selector: 'app-notification-manager',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, IconComponent],
  templateUrl: './notification-manager.component.html',

  styles: [`
    .custom-scrollbar::-webkit-scrollbar { width: 5px; }
    .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
    .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
    .line-clamp-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  `]
})
export class NotificationManagerComponent implements OnInit {
  private notifService = inject(NotificationService);
  private centerService = inject(CenterService);
  private fb = inject(FormBuilder);

  history = signal<AdminNotificationBatch[]>([]);
  centers = signal<Center[]>([]);
  isLoading = signal(true);
  isSending = signal(false);

  broadcastForm: FormGroup;

  constructor() {
    this.broadcastForm = this.fb.group({
      target: ['ALL', Validators.required],
      title: ['', [Validators.required, Validators.minLength(3)]],
      body: ['', [Validators.required, Validators.minLength(5)]],
      centerId: [null],
      level: ['']
    });

    this.broadcastForm.get('target')?.valueChanges.subscribe(val => {
      const centerControl = this.broadcastForm.get('centerId');
      const levelControl = this.broadcastForm.get('level');
      
      centerControl?.clearValidators();
      levelControl?.clearValidators();

      if (val === 'BY_CENTER') {
        centerControl?.setValidators(Validators.required);
      } else if (val === 'BY_LEVEL') {
        levelControl?.setValidators(Validators.required);
      }
      
      centerControl?.updateValueAndValidity();
      levelControl?.updateValueAndValidity();
    });
  }

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.isLoading.set(true);
    this.centerService.getCenters().subscribe(res => this.centers.set(res.data));
    this.notifService.getNotificationBatches(1, 20)
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe(res => {
        if (res.success) this.history.set(res.data);
      });
  }

  sendBroadcast() {
    if (this.broadcastForm.invalid || this.isSending()) return;
    
    const count = this.broadcastForm.get('target')?.value === 'ALL' ? 'جميع الطلاب' : 'الشريحة المختارة';
    if (!confirm(`هل أنت متأكد من بث هذا الإشعار إلى ${count}؟ لا يمكن تراجع عن هذه العملية.`)) return;

    this.isSending.set(true);
    const formVal = this.broadcastForm.value;
    
    const payload: any = {
      title: formVal.title,
      body: formVal.body
    };

    if (formVal.target === 'ALL') payload.sendToAll = true;
    else if (formVal.target === 'BY_CENTER') payload.centerId = formVal.centerId;
    else if (formVal.target === 'BY_LEVEL') payload.level = formVal.level;

    this.notifService.broadcast(payload)
      .pipe(finalize(() => this.isSending.set(false)))
      .subscribe({
        next: (res) => {
          alert(`تم بث الإشعار بنجاح! تم الإرسال لـ ${res.data.sentCount} طالب.`);
          this.broadcastForm.reset({ target: 'ALL' });
          this.loadData();
        },
        error: (err) => alert(err.error?.message || 'حدث خطأ في البث')
      });
  }

  deleteNotif(notif: AdminNotification) {
    if (confirm('حذف سجل هذا الإشعار من الأرشيف؟ (لن يتم حذفه من هواتف الطلاب)')) {
      this.notifService.deleteNotification(notif.id).subscribe(() => this.loadData());
    }
  }
}
