import { IconComponent } from '../shared/icon.component';
import { Component, inject, OnInit, signal, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, switchMap, catchError, of } from 'rxjs';
import { ApiService } from '../core/api.service';
import { Course } from '../core/models';
import { CourseCardComponent } from '../shared/course-card.component';
import { LearningLottieComponent } from '../shared/learning-lottie.component';

@Component({selector:'app-courses',standalone:true,imports:[IconComponent,FormsModule,CourseCardComponent,LearningLottieComponent],template:`
<div class="page-stack catalogue-page editorial-catalogue">
  <header class="page-intro"><div><span class="eyebrow">{{mine()?'TON PARCOURS':'TON CAMPUS · LES MATIÈRES'}}</span><h1>{{mine()?'Mes cours, à mon rythme':'Qu’as-tu envie d’apprendre ?'}}</h1><p>{{mine()?'Tout ce que tu as commencé, au même endroit. Reprends quand tu veux.':'Trouve une matière qui t’intéresse et avance leçon après leçon.'}}</p></div></header>
  @if(!mine()){<div class="campus-catalog-intro"><div><span class="eyebrow">UNE MATIÈRE À LA FOIS</span><strong>De la curiosité aux premières leçons.</strong><p>Informatique, langues, sciences… À toi de choisir par où commencer.</p></div><img src="/assets/illustrations/3d/cours-en-ligne.png" width="160" height="160" loading="lazy" alt=""/></div>}
  <section class="catalogue-toolbar" aria-label="Recherche et filtres du catalogue">
    <div class="catalogue-topline"><div><h2>{{mine()?'Mes formations':'Trouver mon prochain cours'}}</h2><p>{{mine()?'Tes cours sont prêts à être repris.':'Tape un sujet ou parcours les matières ci-dessous.'}}</p></div><span class="results-count"><app-icon name="book-open"/> {{courses().length}} {{courses().length===1?'cours trouvé':'cours trouvés'}}</span></div>
    <div class="filters-bar"><label class="search-field"><app-icon name="search"/><input [(ngModel)]="search" (input)="load()" placeholder="Titre d'un cours, sujet..." aria-label="Rechercher par titre ou sujet"/><span class="search-hint">Entrer un mot-clé</span></label>
      @if(search || category){<button type="button" class="btn btn-soft btn-small" (click)="reset()"><app-icon name="x"/> Effacer les filtres</button>}
    </div>
    <div class="category-pills" role="group" aria-label="Filtrer les cours par catégorie"><button type="button" [class.selected]="category===''" [attr.aria-pressed]="category===''" (click)="selectCategory('')"><app-icon name="list"/> Toutes les matières</button>@for(cat of categories;track cat){<button type="button" [class.selected]="category===cat" [attr.aria-pressed]="category===cat" (click)="selectCategory(cat)">{{cat}}</button>}</div>
  </section>
  @if(loading()){<div class="loading-state campus-loading-state" role="status" aria-live="polite"><app-learning-lottie animation="book-loading" [loop]="true" [size]="94"/><span>Recherche des cours…</span></div>}
  @else if(error()){<div class="empty-state"><app-icon name="circle-alert"/><h3>Impossible de charger les cours</h3><p>Vérifiez que le serveur FastAPI est accessible.</p><button class="btn btn-primary" (click)="load()">Réessayer</button></div>}
  @else if(courses().length){<div class="course-grid" aria-live="polite">@for(course of courses();track course.id){<app-course-card [course]="course"/>}</div>}
  @else {<div class="empty-state"><app-learning-lottie animation="education-animation" [size]="144"/><h3>Aucun cours trouvé</h3><p>Essayez une autre recherche ou effacez les filtres.</p><button class="btn btn-primary" (click)="reset()">Réinitialiser</button></div>}
</div>`})
export class CoursesPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly refresh$ = new Subject<void>();
  readonly mine = signal(false);
  readonly courses = signal<Course[]>([]);
  readonly loading = signal(true);
  readonly error = signal(false);
  search = '';
  category = '';
  readonly categories = ['Informatique','Mathématiques','Économie','Méthodologie','Sciences','Langues','Général'];
  constructor() {
    this.refresh$.pipe(debounceTime(180),switchMap(() => {
      this.loading.set(true);this.error.set(false);
      return this.api.courses(this.search,this.category,this.mine()).pipe(catchError(() => {this.error.set(true);return of(null);}));
    }),takeUntilDestroyed()).subscribe(items => {if(items!==null)this.courses.set(items);this.loading.set(false);});
  }
  ngOnInit(): void {
    this.route.data.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(data => {this.mine.set(!!data['mine']);this.load();});
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(map => {this.search=map.get('q')||'';this.load();});
  }
  selectCategory(cat:string):void {this.category=cat;this.load();}
  load():void {this.refresh$.next();}
  reset():void {this.search='';this.category='';this.load();}
}
