import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { LucideDynamicIcon } from '@lucide/angular';

/** One consistent visual language across the three CampusLearn interfaces. */
@Component({
  selector: 'app-icon',
  standalone: true,
  imports: [LucideDynamicIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'class': 'app-icon' },
  template: `<svg [lucideIcon]="name()" [strokeWidth]="strokeWidth()" aria-hidden="true" focusable="false"></svg>`
})
export class IconComponent {
  readonly name = input.required<string>();
  readonly strokeWidth = input(2);
}
