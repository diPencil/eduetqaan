import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ModalService } from './modal.service';
import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'app-confirm-modal',
  standalone: true,
  imports: [CommonModule, IconComponent],
  templateUrl: './confirm-modal.component.html',
})
export class ConfirmModalComponent {
  modalService = inject(ModalService);

  getIcon(type?: string): string {
    switch (type) {
      case 'warning': return 'alert-circle';
      case 'primary': return 'check-circle';
      default: return 'alert-triangle';
    }
  }

  onConfirm(options: any) {
    options.onConfirm();
    this.modalService.closeConfirm();
  }

  onCancel(options: any) {
    if (options.onCancel) {
      options.onCancel();
    }
    this.modalService.closeConfirm();
  }
}
