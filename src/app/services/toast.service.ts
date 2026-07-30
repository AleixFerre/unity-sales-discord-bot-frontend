import { Injectable, signal } from '@angular/core';

export type ToastType = 'success' | 'error';
export type Toast = { id: number; type: ToastType; text: string };

const TOAST_DURATION_MS = 5000;

/** App-wide toast notifications, rendered by ToastContainerComponent at the root. */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 0;
  private readonly toastsState = signal<Toast[]>([]);
  readonly toasts = this.toastsState.asReadonly();

  success(text: string): void {
    this.show('success', text);
  }

  error(text: string): void {
    this.show('error', text);
  }

  dismiss(id: number): void {
    this.toastsState.update((toasts) => toasts.filter((toast) => toast.id !== id));
  }

  private show(type: ToastType, text: string): void {
    const toast: Toast = { id: this.nextId++, type, text };
    this.toastsState.update((toasts) => [...toasts, toast]);
    setTimeout(() => this.dismiss(toast.id), TOAST_DURATION_MS);
  }
}
