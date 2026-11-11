import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, Input, OnChanges, OnDestroy, SimpleChanges, ViewChild, signal } from '@angular/core';
import { IconComponent } from './icon.component';
import type { DotLottie } from '@lottiefiles/dotlottie-web';

/** All animations are locally hosted; the dotLottie archives embed their image assets. */
export type CampusLottieName = 'book-loading' | 'loading-book' | 'success-checkmark' | 'education-certificate' | 'education-animation';
const fallbackIcons: Record<CampusLottieName, string> = {
  'book-loading': 'book-open',
  'loading-book': 'file-text',
  'success-checkmark': 'circle-check',
  'education-certificate': 'graduation-cap',
  'education-animation': 'book-open',
};

@Component({
  selector: 'app-learning-lottie',
  standalone: true,
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="campus-lottie-frame" [style.width.px]="size" [style.height.px]="size" aria-hidden="true">
      <canvas #canvas [hidden]="reduceMotion() || failed()" width="240" height="240"></canvas>
      @if(reduceMotion() || failed() || !ready()) {
        <span class="campus-lottie-static"><app-icon [name]="fallbackIcons[animation]" /></span>
      }
    </span>
  `,
  styles: [`
    :host { display:inline-flex;align-items:center;justify-content:center;max-width:100%;vertical-align:middle;flex:none; }
    .campus-lottie-frame {display:inline-flex;align-items:center;justify-content:center;position:relative;max-width:100%;max-height:100%;overflow:hidden;}
    canvas {width:100%;height:100%;display:block;object-fit:contain;position:absolute;inset:0;z-index:1;}
    canvas[hidden] {display:none}
    .campus-lottie-static {display:grid;place-items:center;width:100%;height:100%;color:#5f6380;background:#f1f1f8;border-radius:24%;}
    .campus-lottie-static app-icon {font-size:clamp(24px,4vw,44px)}
  `],
})
export class LearningLottieComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input({required:true}) animation: CampusLottieName = 'book-loading';
  @Input() size = 96;
  @Input() loop = false;
  @ViewChild('canvas', {static:true}) canvas!: ElementRef<HTMLCanvasElement>;
  readonly fallbackIcons = fallbackIcons;
  readonly reduceMotion = signal(false);
  readonly failed = signal(false);
  readonly ready = signal(false);
  private mediaQuery: MediaQueryList | null = null;
  private player: DotLottie | null = null;
  private mounted = false;
  private revision = 0;

  private readonly onPreferenceChange = (event: MediaQueryListEvent) => {
    this.reduceMotion.set(event.matches);
    if (event.matches) { this.teardown(); }
    else { void this.start(); }
  };

  ngAfterViewInit(): void {
    this.mounted = true;
    if (typeof window === 'undefined') return;
    this.mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.reduceMotion.set(this.mediaQuery.matches);
    this.mediaQuery.addEventListener('change', this.onPreferenceChange);
    if (!this.mediaQuery.matches) void this.start();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (this.mounted && (changes['animation'] || changes['loop']) && !this.reduceMotion()) {
      void this.start();
    }
  }

  private async start(): Promise<void> {
    this.teardown();
    this.failed.set(false);
    this.ready.set(false);
    const generation = this.revision;
    try {
      // The rendering engine is fetched only when an animation is actually displayed.
      const { DotLottie } = await import('@lottiefiles/dotlottie-web');
      // Bundle the version-matched WASM engine through angular.json: no CDN required at runtime.
      DotLottie.setWasmUrl('/assets/lottie/engine/dotlottie-player.wasm');
      if (!this.mounted || this.revision !== generation || this.reduceMotion()) return;
      const instance = new DotLottie({
        canvas: this.canvas.nativeElement,
        src: `/assets/lottie/${this.animation}.lottie`,
        autoplay: true,
        loop: this.loop,
        renderConfig: { autoResize: true },
      });
      instance.addEventListener('load', () => { if (this.mounted && this.revision === generation) this.ready.set(true); });
      instance.addEventListener('loadError', () => { if (this.mounted && this.revision === generation) this.failed.set(true); });
      instance.addEventListener('renderError', () => { if (this.mounted && this.revision === generation) this.failed.set(true); });
      this.player = instance;
    } catch {
      if (this.mounted && this.revision === generation) this.failed.set(true);
    }
  }

  private teardown(): void {
    this.revision++;
    this.player?.destroy();
    this.player = null;
  }

  ngOnDestroy(): void {
    this.mounted = false;
    this.mediaQuery?.removeEventListener('change', this.onPreferenceChange);
    this.teardown();
  }
}
