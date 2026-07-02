import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ModalService } from './modal.service';
import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'app-alert-modal',
  standalone: true,
  imports: [CommonModule, IconComponent],
  templateUrl: './alert-modal.component.html',
})
export class AlertModalComponent {
  modalService = inject(ModalService);

  getIcon(type?: string): string {
    switch (type) {
      case 'success': return 'check-circle';
      case 'error': return 'x-circle';
      case 'warning': return 'alert-triangle';
      case 'info': return 'info';
      default: return 'check-circle';
    }
  }

  onClose(options: any) {
    if (options.onClose) {
      options.onClose();
    }
    this.modalService.closeAlert();
  }
}
