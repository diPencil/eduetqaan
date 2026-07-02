import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class LoadingService {
  private activeRequests = signal<number>(0);
  
  // Computed signal to determine if loading is active
  isLoading = signal<boolean>(false);

  show() {
    this.activeRequests.update(count => {
      const newCount = count + 1;
      if (newCount === 1) {
        this.isLoading.set(true);
      }
      return newCount;
    });
  }

  hide() {
    this.activeRequests.update(count => {
      const newCount = Math.max(0, count - 1);
      if (newCount === 0) {
        this.isLoading.set(false);
      }
      return newCount;
    });
  }

  reset() {
    this.activeRequests.set(0);
    this.isLoading.set(false);
  }
}
