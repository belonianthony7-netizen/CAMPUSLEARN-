import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { IconComponent } from './icon.component';
import { youtubeVideoId } from '../core/youtube';

/** A privacy-conscious inline player. YouTube is contacted only after a click. */
@Component({
  selector: 'app-youtube-player', standalone: true,
  imports: [IconComponent], changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if(videoId(); as id) {
      <section class="campus-youtube" aria-label="Vidéo du cours">
        <div class="campus-youtube-top"><span><app-icon name="clapperboard"/> Vidéo du cours</span><span class="campus-youtube-label">YouTube</span></div>
        <div class="campus-youtube-frame">
          @if(playingVideoId() === id) {
            <iframe [src]="embeddedUrl()" title="Lecteur vidéo YouTube de la leçon" loading="lazy"
              referrerpolicy="strict-origin-when-cross-origin"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowfullscreen></iframe>
          } @else {
            <button type="button" class="campus-youtube-play" (click)="playingVideoId.set(id)" aria-label="Lire la vidéo YouTube dans cette page">
              <span class="campus-youtube-circle"><app-icon name="play"/></span>
              <strong>Voir la vidéo de cette leçon</strong>
              <small>La vidéo YouTube se charge après votre clic.</small>
            </button>
          }
        </div>
        <div class="campus-youtube-bottom">
          <span><app-icon name="info"/> Lecture intégrée à CampusLearn</span>
          <a [href]="watchUrl()" target="_blank" rel="noopener noreferrer">Ouvrir sur YouTube <app-icon name="external-link"/></a>
        </div>
      </section>
    }
  `
})
export class YoutubePlayerComponent {
  readonly url = input<string | null | undefined>(null);
  readonly playingVideoId = signal<string | null>(null);
  readonly videoId = computed(() => youtubeVideoId(this.url()));
  readonly watchUrl = computed(() => `https://www.youtube.com/watch?v=${this.videoId() ?? ''}`);
  private readonly sanitizer = inject(DomSanitizer);
  // Important: always construct a fixed trusted domain from a *validated ID*, never trust a URL provided by a user.
  readonly embeddedUrl = computed(() => this.sanitizer.bypassSecurityTrustResourceUrl(
    `https://www.youtube-nocookie.com/embed/${this.videoId() ?? ''}?rel=0&playsinline=1`
  ));
}
