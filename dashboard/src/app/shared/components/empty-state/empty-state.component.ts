import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [CommonModule, IconComponent],
  templateUrl: './empty-state.component.html',
})
export class EmptyStateComponent {
  @Input() icon: string = 'inbox';
  @Input() title: string = 'لا توجد بيانات';
  @Input() message: string = 'لم يتم العثور على أي نتائج مطابقة للبحث أو الفلتر الحالي.';
  @Input() actionLabel?: string;
  @Input() theme: 'primary' | 'danger' | 'warning' | 'neutral' = 'neutral';
  
  @Output() action = new EventEmitter<void>();

  get colorClass(): string {
    switch(this.theme) {
      case 'primary': return 'text-blue-500 bg-blue-50';
      case 'danger': return 'text-rose-500 bg-rose-50';
      case 'warning': return 'text-amber-500 bg-amber-50';
      default: return 'text-slate-400 bg-slate-50';
    }
  }

  get buttonClass(): string {
    switch(this.theme) {
      case 'primary': return 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/30';
      case 'danger': return 'bg-rose-600 hover:bg-rose-700 shadow-rose-500/30';
      case 'warning': return 'bg-amber-600 hover:bg-amber-700 shadow-amber-500/30';
      default: return 'bg-slate-900 hover:bg-slate-800 shadow-slate-900/30';
    }
  }
}
