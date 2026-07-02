import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../icon/icon.component';

export type CardTheme = 'primary' | 'success' | 'warning' | 'danger' | 'indigo' | 'slate';

@Component({
  selector: 'app-stat-card',
  standalone: true,
  imports: [CommonModule, IconComponent],
  templateUrl: './stat-card.component.html',
})
export class StatCardComponent {
  @Input() label: string = '';
  @Input() value: string | number = '';
  @Input() suffix?: string;
  @Input() subtext?: string;
  @Input() icon: string = 'circle';
  @Input() theme: CardTheme = 'primary';

  get hoverBorderClass(): string {
    const map: Record<CardTheme, string> = {
      primary: 'hover:border-blue-200',
      success: 'hover:border-emerald-200',
      warning: 'hover:border-amber-200',
      danger: 'hover:border-rose-200',
      indigo: 'hover:border-indigo-200',
      slate: 'hover:border-slate-300'
    };
    return map[this.theme];
  }

  get bgTextClass(): string {
    const map: Record<CardTheme, string> = {
      primary: 'text-blue-50',
      success: 'text-emerald-50',
      warning: 'text-amber-50',
      danger: 'text-rose-50',
      indigo: 'text-indigo-50',
      slate: 'text-slate-50'
    };
    return map[this.theme];
  }

  get valueTextClass(): string {
    const map: Record<CardTheme, string> = {
      primary: 'text-blue-600',
      success: 'text-emerald-600',
      warning: 'text-amber-600',
      danger: 'text-rose-600',
      indigo: 'text-indigo-600',
      slate: 'text-slate-800'
    };
    return map[this.theme];
  }
}
