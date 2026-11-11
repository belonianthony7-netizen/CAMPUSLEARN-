import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from './icon.component';
import { Course } from '../core/models';
import { coverFor, fallbackForCover, remoteForCover } from '../core/course-artwork';
import { CampusIllustrationComponent } from './campus-illustration.component';

@Component({selector:'app-course-card',standalone:true,imports:[IconComponent,RouterLink,CampusIllustrationComponent],template:`
<a class="course-card" [routerLink]="['/cours',course().id]" [attr.aria-label]="'Consulter le cours : '+course().title">
  <div class="course-cover" [class.cover-is-object]="isObjectArt()">
    <app-campus-illustration class="cover-illustration" [src]="artwork()" [remote]="artRemote()" [fallback]="artFallback()" [width]="480" [height]="320" />
    <span class="course-level">{{course().level}}</span>
  </div>
  <div class="course-body">
    <div class="course-tags"><span class="eyebrow">{{course().category}}</span>@if(course().is_enrolled){<span class="enrolled-tag"><app-icon name="check"/> Inscrit</span>}</div>
    <h3>{{course().title}}</h3>
    <p class="author"><app-icon name="user-round"/> {{course().teacher_name}}</p>
    <div class="course-meta"><span><app-icon name="clock"/> {{course().duration_hours}} h</span><span><app-icon name="list"/> {{course().lesson_count}} leçons</span></div>
    @if(course().is_enrolled){
      <div class="progress-heading"><small>Progression</small><strong>{{course().progress}} %</strong></div>
      <progress class="course-progress" [value]="course().progress" max="100" [attr.aria-label]="'Progression de '+course().title">{{course().progress}} %</progress>
      <span class="course-link">{{course().progress===100?'Revoir tranquillement':'Reprendre ma leçon'}} <app-icon name="arrow-up-right"/></span>
    } @else {<span class="course-link">Découvrir ce cours <app-icon name="arrow-up-right"/></span>}
  </div>
</a>`})
export class CourseCardComponent {
  readonly course=input.required<Course>();
  artwork():string{const c=this.course();return coverFor(c.title,c.category,c.cover_image);}
  artRemote():string{return remoteForCover(this.course().cover_image);}
  artFallback():string{return fallbackForCover(this.course().cover_image);}
  isObjectArt():boolean{return /^(pastel-|i3d-)/.test(this.course().cover_image||'');}
}
