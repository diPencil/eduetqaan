import { Injectable, signal } from '@angular/core';

export interface ConfirmModalOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmType?: 'danger' | 'warning' | 'primary';
  onConfirm: () => void;
  onCancel?: () => void;
}

export interface AlertModalOptions {
  title: string;
  message: string;
  type?: 'success' | 'error' | 'info' | 'warning';
  buttonText?: string;
  onClose?: () => void;
}

@Injectable({
  providedIn: 'root'
})
export class ModalService {
  confirmOptions = signal<ConfirmModalOptions | null>(null);
  alertOptions = signal<AlertModalOptions | null>(null);

  confirm(options: ConfirmModalOptions) {
    this.confirmOptions.set(options);
  }

  closeConfirm() {
    this.confirmOptions.set(null);
  }

  alert(options: AlertModalOptions) {
    this.alertOptions.set(options);
  }

  closeAlert() {
    this.alertOptions.set(null);
  }
}
