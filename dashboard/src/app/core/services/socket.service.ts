import { Injectable, inject } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ToastService } from '../../shared/components/toast/toast.service';

@Injectable({
  providedIn: 'root'
})
export class SocketService {
  private socket: Socket;
  private toastService = inject(ToastService);

  constructor() {
    // Initialize Socket connection
    // TODO: In production, pass auth tokens in extraHeaders or auth object
    this.socket = io(environment.apiUrl || 'http://localhost:3000', {
      transports: ['websocket'],
      autoConnect: false // We will connect manually when user logs in
    });

    this.setupListeners();
  }

  connect() {
    if (!this.socket.connected) {
      this.socket.connect();
    }
  }

  disconnect() {
    if (this.socket.connected) {
      this.socket.disconnect();
    }
  }

  private setupListeners() {
    // Generic system notification
    this.socket.on('notification', (data: any) => {
      this.toastService.show(data.message, data.type || 'info', data.title);
    });

    // Real-time payment alert
    this.socket.on('new_payment', (data: any) => {
      this.toastService.success(`تم استلام ${data.amount} جنية من ${data.studentName}`, 'عملية دفع جديدة');
    });

    // Handle connection errors
    this.socket.on('connect_error', (err) => {
      console.warn('Socket connection error:', err.message);
    });
  }

  // Generic method to listen to any custom event
  listen<T>(eventName: string): Observable<T> {
    return new Observable((subscriber) => {
      this.socket.on(eventName, (data: T) => {
        subscriber.next(data);
      });

      // Cleanup
      return () => this.socket.off(eventName);
    });
  }

  // Method to emit events to the server
  emit(eventName: string, data: any) {
    this.socket.emit(eventName, data);
  }
}
