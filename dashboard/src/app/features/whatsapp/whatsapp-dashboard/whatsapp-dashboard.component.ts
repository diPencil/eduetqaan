import { Component, inject, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { WhatsappService, WhatsappStatus, WhatsappCampaign } from '../../../core/services/whatsapp.service';
import { finalize, interval, Subscription, switchMap, takeWhile } from 'rxjs';

@Component({
  selector: 'app-whatsapp-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, IconComponent],
  templateUrl: './whatsapp-dashboard.component.html',

  styles: [`
    .custom-scrollbar::-webkit-scrollbar { width: 5px; }
    .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
    .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
  `]
})
export class WhatsappDashboardComponent implements OnInit, OnDestroy {
  private whatsappService = inject(WhatsappService);
  private fb = inject(FormBuilder);

  activeTab = signal<'connection' | 'campaigns' | 'history'>('connection');
  status = signal<WhatsappStatus | null>(null);
  campaigns = signal<WhatsappCampaign[]>([]);
  lessons = signal<any[]>([]);
  centers = signal<any[]>([]);
  isSending = signal(false);
  
  quickTemplates = [
    { label: 'تذكير بالحضور', body: 'أهلاً يا {{name}}، نذكرك بموعد حصتك اليوم الساعة ... بالتوفيق 🎉' },
    { label: 'تنبيه غياب', body: 'أهلاً يا {{name}}، لقد تم تسجيل غيابك عن حصة اليوم لمشجعة ... نرجو الالتزام.' },
    { label: 'إبلاغ بالرصيد', body: 'أهلاً يا {{name}}، رصيدك المتبقي حالياً هو {{balance}} ج.م.' },
  ];
  
  campaignForm: FormGroup;
  private statusSub?: Subscription;

  constructor() {
    this.campaignForm = this.fb.group({
      title: ['', Validators.required],
      targetType: ['FILTERS', Validators.required],
      messageTemplate: ['', Validators.required],
      lessonId: [null],
      specificCodes: [''], // Added field for specific student codes
      batchSize: [5],
      batchDelay: [10],
      filters: this.fb.group({
        level: [''],
        centerId: [null]
      })
    });
  }

  ngOnInit() {
    this.refreshStatus();
    this.loadArchives();
    
    // Polling status only when QR is shown or app just started
    this.statusSub = interval(5000).pipe(
      switchMap(() => this.whatsappService.getStatus())
    ).subscribe(res => {
      if (res.success) this.status.set(res.data);
    });
  }

  ngOnDestroy() {
    this.statusSub?.unsubscribe();
  }

  refreshStatus() {
    this.whatsappService.getStatus().subscribe(res => {
      if (res.success) this.status.set(res.data);
    });
  }

  loadArchives() {
    this.whatsappService.getCampaigns().subscribe(res => this.campaigns.set(res.data));
    this.whatsappService.getLessons().subscribe(res => this.lessons.set(res.data));
    this.whatsappService.getCenters().subscribe(res => this.centers.set(res.data));
  }

  initConnection() {
    this.whatsappService.initClient().subscribe(res => {
      this.refreshStatus();
    });
  }

  logout() {
    if (confirm('هل أنت متأكد من مَسح جلسة الواتساب الحالية؟ ستحتاج للمسح مرة أخرى بالهاتف.')) {
      this.whatsappService.logoutClient().subscribe(() => this.refreshStatus());
    }
  }

  updateFilters(event: any, field: string) {
    const filters = this.campaignForm.get('filters') as FormGroup;
    filters.patchValue({ [field]: event.target.value });
  }

  sendCampaign() {
    if (this.campaignForm.invalid || this.isSending()) return;
    
    if (!confirm('تأكيد بدء حملة الرسائل؟ سيتم الإرسال لعدد كبير من الطلاب.')) return;

    this.isSending.set(true);
    const formVal = this.campaignForm.value;
    
    this.whatsappService.startCampaign(formVal)
      .pipe(finalize(() => this.isSending.set(false)))
      .subscribe({
        next: (res) => {
          alert(`تم بدء الحملة بنجاح! كود الحملة: ${res.campaignId}`);
          this.loadArchives();
          this.campaignForm.reset({ targetType: 'FILTERS', batchSize: 5, batchDelay: 10 });
          this.activeTab.set('history');
        },
        error: (err) => alert(err.error?.message || 'حدث خطأ في الإرسال')
      });
  }

  insertVariable(variable: string) {
    const current = this.campaignForm.get('messageTemplate')?.value || '';
    this.campaignForm.patchValue({ messageTemplate: current + variable });
  }

  useTemplate(body: string) {
    this.campaignForm.patchValue({ messageTemplate: body });
  }
}
