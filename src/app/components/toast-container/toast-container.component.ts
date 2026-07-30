import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-toast-container',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './toast-container.component.html',
  styleUrl: './toast-container.component.scss',
})
export class ToastContainerComponent {
  protected readonly toasts = inject(ToastService);
}
