import { IconComponent } from '../shared/icon.component';
import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { COVER_PRESETS, coverFor, fallbackForCover, remoteForCover } from '../core/course-artwork';
import { CAMPUS_ART_ASSETS, ART_GROUP_LABELS, type AssetGroup } from '../core/illustration-catalog';
import { CampusIllustrationComponent } from '../shared/campus-illustration.component';
import { Announcement, Assignment, Course, CourseStudent, CourseQuizAttempt, Lesson, Post, Quiz, Submission } from '../core/models';
import { LearningLottieComponent, type CampusLottieName } from '../shared/learning-lottie.component';
import { YoutubePlayerComponent } from '../shared/youtube-player.component';
import { youtubeVideoId } from '../core/youtube';

type Tab = 'lecons'|'quiz'|'devoirs'|'discussions'|'annonces'|'etudiants';
type Composer = 'lecon'|'quiz'|'devoir'|'annonce'|null;
@Component({selector:'app-course-detail',standalone:true,imports:[IconComponent,RouterLink,FormsModule,DatePipe,LearningLottieComponent,CampusIllustrationComponent,YoutubePlayerComponent],template:`
<div class="page-stack">
@if(loading()){<div class="loading-state campus-loading-state" role="status"><app-learning-lottie animation="book-loading" [size]="104" [loop]="true"/><span>Chargement du cours…</span></div>}
@else if(course();as c){
  <a routerLink="/cours" class="back-link"><app-icon name="arrow-left"></app-icon> Retour aux cours</a>
  <section class="course-detail-hero" [style.--course-color]="c.color"><div class="course-detail-content"><div class="detail-badges"><span>{{c.category}}</span><span>{{c.level}}</span>@if(!c.published){<span>Brouillon</span>}</div><h1>{{c.title}}</h1><p>{{c.description}}</p><div class="detail-meta"><span><app-icon name="user-round"></app-icon> {{c.teacher_name}}</span><span><app-icon name="clock"></app-icon> {{c.duration_hours}} h</span><span><app-icon name="list"></app-icon> {{c.lesson_count}} leçons</span><span><app-icon name="users-round"></app-icon> {{c.student_count}} inscrits</span></div></div><div class="detail-art"><app-campus-illustration [src]="coverForCourse(c)" [remote]="remoteForCover(c.cover_image)" [fallback]="fallbackForCover(c.cover_image)" [width]="480" [height]="320" /></div></section>
  @if(auth.user()?.role==='student'&&!c.is_enrolled){<section class="enroll-banner"><div><h3>Ce cours t’intéresse ?</h3><p>Inscris-toi pour débloquer les leçons, les quiz et les discussions.</p></div><button class="btn btn-primary" [disabled]="busy()" (click)="enroll()"><app-icon name="plus"></app-icon> S'inscrire au cours</button></section>}
  @else {
    @if(auth.user()?.role==='student'){<div class="progress-panel"><div><strong>Ton chemin parcouru</strong><p>Chaque leçon terminée compte.</p></div><div class="progress-track"><span>{{c.progress}} %</span><progress class="course-progress" [value]="c.progress" max="100" aria-label="Progression du cours">{{c.progress}} %</progress></div></div>}
    @if(managing()){
      <div class="teacher-actions"><span class="eyebrow">GÉRER LA FORMATION</span><button class="btn btn-soft" (click)="newLesson()"><app-icon name="plus"></app-icon> Leçon</button><button class="btn btn-soft" (click)="newLesson(true)"><app-icon name="video"/> Vidéo YouTube</button><button class="btn btn-soft" (click)="composer.set('quiz')"><app-icon name="plus"></app-icon> Quiz</button><button class="btn btn-soft" (click)="composer.set('devoir')"><app-icon name="plus"></app-icon> Devoir</button><button class="btn btn-soft" (click)="composer.set('annonce')"><app-icon name="megaphone"></app-icon> Annonce</button><button class="btn btn-soft" (click)="openCoverPicker(c)"><app-icon name="image"/> Couverture</button><button class="btn" [class.btn-success]="!c.published" [class.btn-soft]="c.published" (click)="togglePublished()">{{c.published?'Dépublier':'Publier le cours'}}</button></div>
      @if(showCoverPicker()){
        <section class="panel editor-panel artwork-panel" aria-label="Modifier la couverture du cours">
          <div class="panel-title"><div><h3>Couverture du cours</h3><p>Choisissez une illustration adaptée au contenu.</p></div><button class="icon-button" aria-label="Fermer" (click)="showCoverPicker.set(false)"><app-icon name="x"/></button></div>
          <div class="artwork-family-bar" role="group" aria-label="Famille de couvertures"><button type="button" [class.active]="artworkFamily()==='standard'" (click)="artworkFamily.set('standard')">Classiques</button>@for(group of groupKeys;track group){<button type="button" [class.active]="artworkFamily()===group" (click)="artworkFamily.set(group)">{{artGroupLabels[group]}}</button>}</div>
          <div class="artwork-picker">
            @for(preset of filteredArtworkPresets();track preset.id){
              <button type="button" class="artwork-choice" [class.selected]="selectedCover===preset.id" [attr.aria-pressed]="selectedCover===preset.id" (click)="selectedCover=preset.id">
                <app-campus-illustration [src]="coverFor(c.title,c.category,preset.id)" [remote]="remoteForCover(preset.id)" [fallback]="fallbackForCover(preset.id)" [width]="480" [height]="320" />
                <span>{{preset.label}} @if(selectedCover===preset.id){<app-icon name="check"/>}</span>
              </button>
            }
          </div>
          <button class="btn btn-primary" [disabled]="busy()" (click)="saveCover()"><app-icon name="save"/> Enregistrer la couverture</button>
        </section>
      }
      @if(composer()){
        <div id="course-lesson-editor" class="panel editor-panel"><div class="panel-title"><h3>{{composer()==='lecon'?(editingLessonId()?'Modifier la leçon':videoMode()?'Nouvelle leçon vidéo':'Nouvelle leçon'):composer()==='quiz'?'Nouveau quiz':composer()==='devoir'?'Nouveau devoir':'Nouvelle annonce'}}</h3><button class="icon-button" aria-label="Fermer" (click)="composer.set(null)"><app-icon name="x"></app-icon></button></div>
          @if(composer()==='lecon'){
            <div class="campus-video-form-intro"><span class="campus-video-icon"><app-icon name="video"/></span><div><strong>{{videoMode()?'Préparer une leçon vidéo':'Contenu de la leçon'}}</strong><p>{{videoMode()?'Collez le lien YouTube de votre choix : les étudiants pourront le regarder sans quitter CampusLearn.':'Ajoutez vos explications et, si besoin, une vidéo YouTube pour accompagner les étudiants.'}}</p></div></div>
            <div class="form-grid">
              <label>Titre de la leçon<input [(ngModel)]="lessonForm.title" placeholder="Ex. Introduction à Python" autocomplete="off"/></label>
              <label>Ordre de la leçon<input type="number" min="1" [(ngModel)]="lessonForm.position"/></label>
              <label class="full-width">Explications et notes (facultatives)<textarea rows="5" [(ngModel)]="lessonForm.content" placeholder="Une introduction, des exercices ou un résumé pour accompagner la vidéo..."></textarea></label>
              <label class="full-width campus-youtube-url-field">Lien YouTube (facultatif)
                <input type="url" inputmode="url" [(ngModel)]="lessonForm.video_url" placeholder="https://www.youtube.com/watch?v=..." aria-describedby="campus-youtube-hint" [attr.aria-invalid]="lessonForm.video_url.trim()&&!youtubeVideoId(lessonForm.video_url)?true:null"/>
                <small id="campus-youtube-hint">Liens acceptés : youtube.com/watch, youtu.be, Shorts, Live ou YouTube Embed. Vous n'avez pas besoin de télécharger la vidéo.</small>
                @if(lessonForm.video_url.trim() && !youtubeVideoId(lessonForm.video_url)){
                  <span class="campus-video-error" role="alert"><app-icon name="circle-alert"/> Ce lien n'est pas une URL de vidéo YouTube valide.</span>
                }
              </label>
              @if(youtubeVideoId(lessonForm.video_url)){
                <div class="full-width campus-video-preview"><span class="eyebrow">APERÇU DE LA VIDÉO</span><app-youtube-player [url]="lessonForm.video_url"/></div>
              }
              <label class="full-width">Support PDF ou image (maximum 20 Mo)<input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" (change)="uploadMaterial($event)"/><small class="muted">{{uploadInfo()}}</small>@if(uploading()){<span class="campus-upload-progress" role="status"><app-learning-lottie animation="loading-book" [size]="72" [loop]="true"/><span>Envoi du document…</span></span>}</label>
            </div>
            <div class="campus-video-form-actions"><button type="button" class="btn btn-soft" (click)="cancelLessonEdit()">Annuler</button><button class="btn btn-primary" [disabled]="busy()||uploading()||!!lessonForm.video_url.trim()&&!youtubeVideoId(lessonForm.video_url)" (click)="saveLesson()"><app-icon name="save"/> {{editingLessonId()?'Enregistrer les modifications':'Ajouter cette leçon'}}</button></div>
          }
          @if(composer()==='quiz'){<div class="form-grid"><label>Titre du quiz<input [(ngModel)]="quizForm.title" placeholder="Quiz du chapitre 1"/></label><label>Durée (minutes)<input type="number" min="1" [(ngModel)]="quizForm.duration_minutes"/></label></div><div class="question-editor">@for(question of quizForm.questions;track $index;let i=$index){<div class="question-block"><div class="panel-title"><b>Question {{i+1}}</b><button class="text-btn" (click)="removeQuestion(i)">Supprimer</button></div><input [(ngModel)]="question.prompt" placeholder="Écrivez une question..."/>@for(option of question.options;track $index;let j=$index){<div class="question-option"><input type="radio" [name]="'correct-'+i" [value]="j" [(ngModel)]="question.correct_index"/><input [(ngModel)]="question.options[j]" [placeholder]="'Réponse '+(j+1)"/></div>}</div>}</div><div class="inline-actions"><button class="btn btn-soft" (click)="addQuestion()"><app-icon name="plus"></app-icon> Ajouter une question</button><button class="btn btn-primary" [disabled]="busy()" (click)="saveQuiz()">Enregistrer le quiz</button></div>}
          @if(composer()==='devoir'){<div class="form-grid"><label>Titre du devoir<input [(ngModel)]="assignmentForm.title"/></label><label>Note maximale<input type="number" [(ngModel)]="assignmentForm.max_score" min="1"/></label><label>Date limite (facultative)<input type="datetime-local" [(ngModel)]="assignmentDeadline"/></label><label class="full-width">Consignes<textarea rows="4" [(ngModel)]="assignmentForm.description"></textarea></label></div><button class="btn btn-primary" [disabled]="busy()" (click)="saveAssignment()">Créer le devoir</button>}
          @if(composer()==='annonce'){<div class="form-grid"><label class="full-width">Titre<input [(ngModel)]="announcementTitle"/></label><label class="full-width">Message<textarea rows="4" [(ngModel)]="announcementBody"></textarea></label></div><button class="btn btn-primary" [disabled]="busy()" (click)="saveAnnouncement()">Publier l'annonce</button>}
        </div>
      }
    }
    <div class="course-tabs" role="tablist" aria-label="Rubriques du cours">
      <button [class.selected]="tab()==='lecons'" (click)="tab.set('lecons')"><app-icon name="book-open"></app-icon> Leçons <span>{{lessons().length}}</span></button>
      <button [class.selected]="tab()==='quiz'" (click)="selectQuizzes()"><app-icon name="square-check"></app-icon> Quiz <span>{{quizzes().length}}</span></button>
      <button [class.selected]="tab()==='devoirs'" (click)="tab.set('devoirs')"><app-icon name="file-pen-line"></app-icon> Devoirs <span>{{assignments().length}}</span></button>
      <button [class.selected]="tab()==='discussions'" (click)="tab.set('discussions')"><app-icon name="messages-square"></app-icon> Discussions</button>
      <button [class.selected]="tab()==='annonces'" (click)="tab.set('annonces')"><app-icon name="megaphone"></app-icon> Annonces</button>
      @if(managing()){<button [class.selected]="tab()==='etudiants'" (click)="selectStudents()"><app-icon name="users-round"></app-icon> Étudiants</button>}
    </div>
    @if(tab()==='lecons'){
      <div class="learning-layout"><div class="lesson-sidebar panel"><div class="panel-title"><h3>Programme du cours</h3><small>{{lessons().length}} leçons</small></div>@for(lesson of lessons();track lesson.id;let i=$index){<button class="lesson-row" [class.current]="selectedLessonId()===lesson.id" (click)="selectedLessonId.set(lesson.id)"><span [class.done]="lesson.completed" class="lesson-number">@if(lesson.completed){<app-icon name="check"></app-icon>}@else{<span>{{i+1}}</span>}</span><span>{{lesson.title}}<small>Leçon {{i+1}} @if(youtubeVideoId(lesson.video_url)){ · Vidéo YouTube }</small></span></button>}@empty{<p class="muted">Aucune leçon publiée pour le moment.</p>}</div>
        <div class="lesson-content panel">@if(currentLesson();as lesson){
          <div class="campus-lesson-top"><div><span class="eyebrow">LEÇON {{lesson.position}}</span><h2>{{lesson.title}}</h2></div>@if(managing()){<button type="button" class="btn btn-soft btn-small" (click)="editLesson(lesson)"><app-icon name="pencil-line"/> Modifier</button>}</div>
          @if(lesson.video_url && youtubeVideoId(lesson.video_url)) {
            <app-youtube-player [url]="lesson.video_url"/>
          }
          @if(lesson.content.trim()) {<div class="lesson-text">{{lesson.content}}</div>}
          @if(lesson.material_url || (lesson.video_url && !youtubeVideoId(lesson.video_url))){<div class="resources"><h4>Ressources pédagogiques</h4>@if(lesson.video_url && !youtubeVideoId(lesson.video_url)){<a class="resource-link" [href]="lesson.video_url" target="_blank" rel="noopener noreferrer"><app-icon name="external-link"/> Ancienne ressource vidéo externe</a>}@if(lesson.material_url){<button class="resource-link resource-button" (click)="openMaterial(lesson.material_url)"><app-icon name="file-text"/> Consulter le document <app-icon name="download"/></button>}</div>}
          @if(auth.user()?.role==='student'&&!lesson.completed){<button class="btn btn-primary" (click)="complete(lesson)" [disabled]="busy()"><app-icon name="circle-check"></app-icon> Marquer comme terminé</button>}@else if(lesson.completed){<span class="success-label"><app-icon name="circle-check"></app-icon> Leçon terminée</span>}}@else{<div class="empty-state inner"><app-learning-lottie animation="education-animation" [size]="126"/><h3>Leçons à venir</h3><p>L'enseignant prépare le contenu de ce cours.</p></div>}</div></div>
    }
    @if(tab()==='quiz'){
      <div class="panel"><div class="panel-title"><div><h2>Évaluations et quiz</h2><p>Testez vos connaissances avec des questions à choix multiples.</p></div></div>
        @for(quiz of quizzes();track quiz.id){<div class="exercise-item"><div class="exercise-icon violet"><app-icon name="square-check"></app-icon></div><div class="exercise-desc"><h3>{{quiz.title}}</h3><p>{{quiz.question_count}} questions · {{quiz.duration_minutes}} minutes</p></div><button class="btn btn-soft" (click)="toggleQuiz(quiz.id)">{{selectedQuizId()===quiz.id?'Masquer':managing()?'Voir':'Commencer'}}</button></div>
          @if(selectedQuizId()===quiz.id){<div class="quiz-box">@for(question of quiz.questions;track question.id;let i=$index){<div class="quiz-question"><h4>{{i+1}}. {{question.prompt}}</h4>@for(option of question.options;track $index;let j=$index){<label class="answer-option"><input type="radio" [name]="question.id" [value]="j" [(ngModel)]="quizAnswers[question.id]" [disabled]="managing()"/> {{option}} @if(managing()&&question.correct_index===j){<span class="success-label">✓</span>}</label>}</div>}@if(!managing()){<button class="btn btn-primary" [disabled]="busy()" (click)="sendQuiz(quiz)">Soumettre les réponses</button>}@if(quizResult()){<div class="result-banner campus-quiz-result">@if(quizResult()!.percentage===100){<app-learning-lottie animation="success-checkmark" [size]="88"/>}<span>Résultat : <strong>{{quizResult()!.score}} / {{quizResult()!.total}}</strong> ({{quizResult()!.percentage}} %)</span></div>}</div>}
        }@empty{<div class="empty-state inner"><img class="campus-empty-3d" src="/assets/illustrations/3d/ressources-livres.png" alt="" width="512" height="512" loading="lazy"><h3>Pas encore de quiz</h3><p>Les évaluations seront affichées ici.</p></div>}
        @if(managing()){
          <section aria-labelledby="quiz-results-heading">
            <div class="panel-title"><div><h3 id="quiz-results-heading">Résultats des étudiants</h3><p>Les 500 tentatives les plus récentes, de la plus récente à la plus ancienne.</p></div><button type="button" class="btn btn-soft btn-small" [disabled]="attemptsLoading()" (click)="loadQuizAttempts()">Actualiser</button></div>
            @if(attemptsLoading()){<p role="status">Chargement des résultats…</p>}
            @else if(attemptsError()){<p class="form-error" role="alert">{{attemptsError()}} Utilisez Actualiser pour réessayer.</p>}
            @else{<div class="table-scroll"><table class="data-table"><caption class="sr-only">Tentatives de quiz des étudiants de ce cours</caption><thead><tr><th scope="col">Étudiant</th><th scope="col">Quiz</th><th scope="col">Résultat</th><th scope="col">Date</th></tr></thead><tbody>
              @for(attempt of quizAttempts();track attempt.id){<tr><td><strong>{{attempt.student_name}}</strong></td><td>{{attempt.quiz_title}}</td><td>{{attempt.score}} / {{attempt.total}} ({{attempt.percentage}} %)</td><td>{{attempt.submitted_at|date:'dd MMM yyyy à HH:mm'}}</td></tr>}
              @empty{<tr><td colspan="4">Aucune tentative pour le moment. Les résultats apparaîtront après la remise d'un quiz.</td></tr>}
            </tbody></table></div>}
          </section>
        }
      </div>
    }
    @if(tab()==='devoirs'){
      <div class="panel"><div class="panel-title"><div><h2>Travaux et devoirs</h2><p>Consultez les consignes et gérez vos remises.</p></div></div>
      @for(a of assignments();track a.id){<div class="assignment-item"><div class="assignment-head"><div><h3>{{a.title}}</h3><p>{{a.description}}</p><small><app-icon name="calendar-days"></app-icon> {{a.due_at?(a.due_at|date:'dd MMM yyyy à HH:mm'):'Sans date limite'}} · Noté sur {{a.max_score}}</small></div>@if(a.submission?.score!==null && a.submission?.score!==undefined){<span class="grade-chip">{{a.submission?.score}} / {{a.max_score}}</span>}@else if(a.submission){<span class="tag-soft">Travail remis</span>}</div>
      @if(auth.user()?.role==='student' && a.submission){<div class="copy-card"><strong>Votre remise enregistrée</strong><p>{{a.submission?.content}}</p></div>}
      @if(auth.user()?.role==='student'){@if(a.submission?.feedback){<p class="feedback-note"><app-icon name="message-circle"></app-icon> {{a.submission?.feedback}}</p>}@if(a.submission?.score===null || !a.submission){<textarea rows="3" [(ngModel)]="submissionDraft[a.id]" placeholder="Rédigez votre travail ou collez votre réponse ici..."></textarea><button class="btn btn-primary btn-small" [disabled]="busy()" (click)="submitWork(a)">{{a.submission?'Modifier ma remise':'Remettre le devoir'}}</button>}}
      @else if(managing()){<button class="btn btn-soft btn-small" (click)="loadSubmissions(a)">Voir les copies</button>@if(selectedAssignmentId()===a.id){<div class="copies-list">@for(sub of submissions();track sub.id){<div class="copy-card"><strong>{{sub.student_name}}</strong><p>{{sub.content}}</p><div class="inline-actions"><label>Note <input class="small-number" type="number" min="0" [max]="a.max_score" [(ngModel)]="gradeDraft[sub.id]"/></label><input placeholder="Commentaire de correction" [(ngModel)]="feedbackDraft[sub.id]"/><button class="btn btn-soft btn-small" (click)="saveGrade(sub)">Enregistrer</button></div></div>}@empty{<p class="muted">Aucune copie reçue.</p>}</div>}}</div>}
      @empty{<div class="empty-state inner"><img class="campus-empty-3d" src="/assets/illustrations/3d/planning-calendrier.png" alt="" width="512" height="512" loading="lazy"><h3>Aucun devoir</h3><p>Les travaux proposés apparaîtront ici.</p></div>}
      </div>
    }
    @if(tab()==='discussions'){
      <div class="panel"><div class="panel-title"><div><h2>Discussions</h2><p>Posez vos questions et échangez avec la communauté.</p></div></div><div class="discussion-form"><textarea rows="3" [(ngModel)]="postContent" placeholder="Une question à poser ? Partagez-la avec les autres étudiants..."></textarea><button class="btn btn-primary" [disabled]="busy()||!postContent.trim()" (click)="savePost()"><app-icon name="send"></app-icon> Publier</button></div>@for(p of posts();track p.id){<div class="post-item"><span class="avatar small">{{p.author.charAt(0)}}</span><div><strong>{{p.author}}</strong><span class="post-role">{{p.author_role==='teacher'?'Enseignant':p.author_role==='admin'?'Administrateur':'Étudiant'}} · {{p.created_at|date:'dd MMM yyyy'}}</span><p>{{p.content}}</p></div></div>}@empty{<p class="muted centered">Aucun message. Lancez la discussion !</p>}</div>
    }
    @if(tab()==='annonces'){
      <div class="panel"><div class="panel-title"><div><h2>Annonces du cours</h2><p>Les communications importantes de votre enseignant.</p></div></div>@for(a of announcements();track a.id){<div class="announcement-item"><span class="announcement-icon"><app-icon name="megaphone"></app-icon></span><div><small>{{a.created_at|date:'dd MMM yyyy'}}</small><h3>{{a.title}}</h3><p>{{a.body}}</p></div></div>}@empty{<p class="muted centered">Pas encore d'annonces.</p>}</div>
    }
    @if(tab()==='etudiants' && managing()){
      <div class="panel"><div class="panel-title"><div><h2>Étudiants inscrits</h2><p>Progression, quiz et remises de chaque étudiant.</p></div><button type="button" class="btn btn-soft btn-small" [disabled]="studentsLoading()" (click)="selectStudents()">Actualiser</button></div>
        @if(studentsLoading()){<p role="status">Chargement du suivi…</p>}
        @else if(studentsError()){<p class="form-error" role="alert">{{studentsError()}} Utilisez Actualiser pour réessayer.</p>}
        @else{<div class="table-scroll"><table class="data-table"><caption class="sr-only">Suivi pédagogique des étudiants inscrits</caption><thead><tr><th scope="col">Étudiant</th><th scope="col">E-mail</th><th scope="col">Progression</th><th scope="col">Quiz remis</th><th scope="col">Moyenne quiz</th><th scope="col">Devoirs remis</th><th scope="col">Devoirs corrigés</th></tr></thead><tbody>
          @for(s of students();track s.id){<tr><td><strong>{{s.name}}</strong></td><td>{{s.email}}</td><td>{{s.progress}} %</td><td>{{s.quiz_attempts}}</td><td>{{s.quiz_average===null?'—':s.quiz_average+' %'}}</td><td>{{s.submissions}}</td><td>{{s.graded_submissions}}</td></tr>}
          @empty{<tr><td colspan="7">Aucun étudiant inscrit. Le suivi apparaîtra après la première inscription.</td></tr>}
        </tbody></table></div>}
      </div>
    }
  }
  @if(message()){<div class="inline-alert campus-feedback" role="status" [class.error-alert]="isError()">@if(feedbackAnimation()){<app-learning-lottie [animation]="feedbackAnimation()!" [size]="feedbackAnimation()==='education-certificate'?108:60"/>}@else{<app-icon [name]="isError()?'circle-alert':'circle-check'"></app-icon>} {{message()}} <button (click)="message.set('')" aria-label="Fermer"><app-icon name="x"></app-icon></button></div>}
}
@else{<div class="empty-state"><h3>Cours indisponible</h3><p>Cette formation n'existe pas ou vous n'avez pas accès à son contenu.</p><a routerLink="/cours" class="btn btn-primary">Revenir au catalogue</a></div>}
</div>`})
export class CourseDetailPage implements OnInit {
  private api=inject(ApiService);private route=inject(ActivatedRoute);readonly auth=inject(AuthService);
  readonly artworkPresets=COVER_PRESETS;readonly coverFor=coverFor;readonly fallbackForCover=fallbackForCover;readonly remoteForCover=remoteForCover;
 readonly artGroupLabels=ART_GROUP_LABELS;readonly groupKeys:AssetGroup[]=['vector','pastel','doodle','icons3d'];
 readonly artworkFamily=signal<'standard'|AssetGroup>('standard');
 readonly filteredArtworkPresets=()=>this.artworkFamily()==='standard'?COVER_PRESETS:CAMPUS_ART_ASSETS.filter(x=>x.group===this.artworkFamily()).map(x=>({id:x.id,label:x.name}));
 readonly showCoverPicker=signal(false);selectedCover='auto';
  id='';course=signal<Course|null>(null);loading=signal(true);busy=signal(false);tab=signal<Tab>('lecons');composer=signal<Composer>(null);
  lessons=signal<Lesson[]>([]);quizzes=signal<Quiz[]>([]);assignments=signal<Assignment[]>([]);posts=signal<Post[]>([]);announcements=signal<Announcement[]>([]);
  students=signal<CourseStudent[]>([]);studentsLoading=signal(false);studentsError=signal('');
  quizAttempts=signal<CourseQuizAttempt[]>([]);attemptsLoading=signal(false);attemptsError=signal('');
  selectedLessonId=signal<string|null>(null);selectedQuizId=signal<string|null>(null);selectedAssignmentId=signal<string|null>(null);
  submissions=signal<Submission[]>([]);quizAnswers:Record<string,number>={};quizResult=signal<{score:number;total:number;percentage:number}|null>(null);
  submissionDraft:Record<string,string>={};gradeDraft:Record<string,number>={};feedbackDraft:Record<string,string>={};postContent='';
  readonly youtubeVideoId=youtubeVideoId;
  readonly editingLessonId=signal<string|null>(null);
  readonly videoMode=signal(false);
  lessonForm:{title:string;content:string;position:number;video_url:string;material_url:string}={title:'',content:'',position:1,video_url:'',material_url:''};
  quizForm:{title:string;duration_minutes:number;questions:{prompt:string;options:string[];correct_index:number}[]}={title:'',duration_minutes:15,questions:[{prompt:'',options:['','','',''],correct_index:0}]};
  assignmentForm={title:'',description:'',max_score:20};assignmentDeadline='';announcementTitle='';announcementBody='';
  message=signal('');isError=signal(false);feedbackAnimation=signal<CampusLottieName|null>(null);private awaitingCompletion=false;uploadInfo=signal('Aucun document ajouté.');uploading=signal(false);
  ngOnInit():void{this.route.paramMap.subscribe(p=>{this.id=p.get('id')||'';this.selectedLessonId.set(null);this.editingLessonId.set(null);this.composer.set(null);this.selectedQuizId.set(null);this.quizResult.set(null);this.feedbackAnimation.set(null);this.awaitingCompletion=false;this.lessons.set([]);this.quizzes.set([]);this.assignments.set([]);this.submissionDraft={};this.quizAttempts.set([]);this.students.set([]);this.load();});}
  toggleQuiz(id:string):void {this.selectedQuizId.set(this.selectedQuizId()===id?null:id);this.quizResult.set(null);this.quizAnswers={};}
  managing():boolean {const c=this.course(),u=this.auth.user();return !!c&&!!u&&(u.role==='admin'||(u.role==='teacher'&&c.teacher_id===u.id));}
  subject(category: string): string {const s=category.toLowerCase();return s.includes('info')?'tech':s.includes('math')?'math':s.includes('écon')?'business':s.includes('lang')?'language':s.includes('science')?'science':'general';}
  coverForCourse(c:Course): string {return coverFor(c.title,c.category,c.cover_image);}
  openCoverPicker(c:Course):void {this.selectedCover=c.cover_image||'auto';this.showCoverPicker.set(!this.showCoverPicker());}
  saveCover():void {const c=this.course();if(!c)return;this.busy.set(true);this.api.updateCourse(c.id,{cover_image:this.selectedCover}).subscribe({next:updated=>{this.course.set(updated);this.showCoverPicker.set(false);this.busy.set(false);this.notice('Couverture enregistrée.');},error:e=>this.error(e)});}
  currentLesson():Lesson|null{return this.lessons().find(l=>l.id===this.selectedLessonId())||this.lessons()[0]||null;}
  notice(text:string,error=false,animation:CampusLottieName|null=null):void {this.message.set(text);this.isError.set(error);this.feedbackAnimation.set(error?null:animation);}
  private error(err:any){this.notice(err?.error?.detail||'Une erreur est survenue. Réessayez.',true);this.busy.set(false);}
  load():void {this.loading.set(true);this.api.course(this.id).subscribe({next:c=>{this.course.set(c);this.loading.set(false);if(this.awaitingCompletion){this.awaitingCompletion=false;if(c.progress>=100)this.notice('Félicitations ! Toutes les leçons de ce cours sont terminées.',false,'education-certificate');}if(c.is_enrolled||this.managing())this.loadContent();},error:()=>{this.course.set(null);this.loading.set(false);}});}
  loadContent():void {
    this.api.lessons(this.id).subscribe({next:items=>{this.lessons.set(items);if(!items.some(l=>l.id===this.selectedLessonId()))this.selectedLessonId.set(items[0]?.id||null);}});
    this.api.quizzes(this.id).subscribe({next:items=>this.quizzes.set(items)});
    this.api.assignments(this.id).subscribe({next:items=>this.setAssignments(items)});
    this.api.posts(this.id).subscribe({next:items=>this.posts.set(items)});
    this.api.announcements(this.id).subscribe({next:items=>this.announcements.set(items)});
  }
  uploadMaterial(event:Event):void {
    const input=event.target as HTMLInputElement;
    const file=input.files?.[0];
    if(!file)return;
    this.uploadInfo.set('Import du document en cours...');this.uploading.set(true);
    this.api.uploadFile(this.id,file).subscribe({next:result=>{this.lessonForm.material_url=result.url;this.uploadInfo.set(`Document ajouté : ${result.name}`);this.uploading.set(false);},error:e=>{this.uploadInfo.set('Échec de l’envoi.');this.uploading.set(false);this.error(e);}});
  }
  openMaterial(url:string):void {
    if(!url.startsWith('/api/files/')){if(/^https?:\/\//.test(url))window.open(url,'_blank','noopener,noreferrer');return;}
    this.api.downloadFile(url).subscribe({next:blob=>{
      const objectUrl=URL.createObjectURL(blob);
      const link=document.createElement('a');link.href=objectUrl;link.download='support-de-cours'+(blob.type==='application/pdf'?'.pdf':blob.type==='image/png'?'.png':blob.type==='image/jpeg'?'.jpg':blob.type==='image/webp'?'.webp':'');
      document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(objectUrl),2000);
    },error:e=>this.error(e)});
  }
  enroll():void{this.busy.set(true);this.api.enroll(this.id).subscribe({next:()=>{this.busy.set(false);this.notice('Inscription confirmée. Bienvenue dans ce cours !',false,'success-checkmark');this.load();},error:e=>this.error(e)});}
  complete(lesson:Lesson):void{if(this.busy())return;this.busy.set(true);this.api.completeLesson(lesson.id).subscribe({next:()=>{this.busy.set(false);this.awaitingCompletion=true;this.notice('Leçon terminée !',false,'success-checkmark');this.load();},error:e=>this.error(e)});}
  togglePublished():void{const c=this.course();if(!c)return;this.api.updateCourse(c.id,{published:!c.published}).subscribe({next:()=>{this.notice('Visibilité du cours mise à jour.');this.load();},error:e=>this.error(e)});}
  newLesson(focusVideo=false):void {
    this.editingLessonId.set(null);this.videoMode.set(focusVideo);
    this.lessonForm={title:'',content:'',position:this.lessons().length+1,video_url:'',material_url:''};
    this.uploadInfo.set('Aucun document ajouté.');
    this.composer.set('lecon');
    this.tab.set('lecons');
    this.scrollToLessonEditor();
  }
  editLesson(lesson:Lesson):void {
    if(!this.managing())return;
    this.editingLessonId.set(lesson.id);this.videoMode.set(!!lesson.video_url);
    this.lessonForm={title:lesson.title,content:lesson.content,position:lesson.position,video_url:lesson.video_url??'',material_url:lesson.material_url??''};
    this.uploadInfo.set(lesson.material_url?'Document déjà ajouté.':'Aucun document ajouté.');
    this.composer.set('lecon');this.tab.set('lecons');this.scrollToLessonEditor();
  }
  private scrollToLessonEditor():void {
    if(typeof window === 'undefined')return;
    requestAnimationFrame(() => document.getElementById('course-lesson-editor')?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'
    }));
  }
  cancelLessonEdit():void{this.composer.set(null);this.editingLessonId.set(null);}
  saveLesson():void {
    if(!this.lessonForm.title.trim())return this.notice('Saisissez un titre pour la leçon.',true);
    if(this.lessonForm.video_url.trim()&&!youtubeVideoId(this.lessonForm.video_url))return this.notice('Collez un lien YouTube valide.',true);
    if(this.busy()||this.uploading())return;
    const payload={...this.lessonForm,title:this.lessonForm.title.trim(),video_url:this.lessonForm.video_url.trim()||null,material_url:this.lessonForm.material_url||null};
    const editId=this.editingLessonId();
    this.busy.set(true);
    const request=editId?this.api.updateLesson(editId,payload):this.api.addLesson(this.id,payload);
    request.subscribe({next:(saved)=>{
      this.selectedLessonId.set(saved.id);this.busy.set(false);this.composer.set(null);this.editingLessonId.set(null);
      this.lessonForm={title:'',content:'',position:this.lessons().length+2,video_url:'',material_url:''};
      this.uploadInfo.set('Aucun document ajouté.');
      this.notice(editId?'Leçon mise à jour.':'Leçon ajoutée au programme.',false,'success-checkmark');
      this.loadContent();this.api.course(this.id).subscribe(c=>this.course.set(c));
    },error:e=>this.error(e)});
  }
  addQuestion():void{this.quizForm.questions.push({prompt:'',options:['','','',''],correct_index:0});}
  removeQuestion(i:number):void{if(this.quizForm.questions.length>1)this.quizForm.questions.splice(i,1);}
  saveQuiz():void{if(!this.quizForm.title.trim()||this.quizForm.questions.some(q=>!q.prompt.trim()||q.options.some(o=>!o.trim())))return this.notice('Complétez toutes les questions et réponses.',true);this.busy.set(true);this.api.addQuiz(this.id,this.quizForm).subscribe({next:()=>{this.busy.set(false);this.composer.set(null);this.quizForm={title:'',duration_minutes:15,questions:[{prompt:'',options:['','','',''],correct_index:0}]};this.api.quizzes(this.id).subscribe(x=>this.quizzes.set(x));this.notice('Quiz ajouté.');},error:e=>this.error(e)});}
  saveAssignment():void{if(!this.assignmentForm.title.trim())return this.notice('Saisissez un titre.',true);this.busy.set(true);this.api.addAssignment(this.id,{...this.assignmentForm,due_at:this.assignmentDeadline?new Date(this.assignmentDeadline).toISOString():null}).subscribe({next:()=>{this.busy.set(false);this.composer.set(null);this.assignmentForm={title:'',description:'',max_score:20};this.assignmentDeadline='';this.api.assignments(this.id).subscribe(x=>this.setAssignments(x));this.notice('Devoir ajouté.');},error:e=>this.error(e)});}
  saveAnnouncement():void{if(!this.announcementTitle.trim()||!this.announcementBody.trim())return this.notice('Complétez le titre et le message.',true);this.busy.set(true);this.api.addAnnouncement(this.id,this.announcementTitle,this.announcementBody).subscribe({next:()=>{this.busy.set(false);this.composer.set(null);this.announcementTitle='';this.announcementBody='';this.api.announcements(this.id).subscribe(x=>this.announcements.set(x));this.notice('Annonce publiée.');},error:e=>this.error(e)});}
  savePost():void{if(!this.postContent.trim())return;this.busy.set(true);this.api.addPost(this.id,this.postContent).subscribe({next:()=>{this.busy.set(false);this.postContent='';this.api.posts(this.id).subscribe(x=>this.posts.set(x));},error:e=>this.error(e)});}
  sendQuiz(q:Quiz):void {if(q.questions.some(x=>this.quizAnswers[x.id]===undefined))return this.notice('Répondez à toutes les questions avant de soumettre.',true);this.busy.set(true);this.api.submitQuiz(q.id,this.quizAnswers).subscribe({next:r=>{this.busy.set(false);this.quizResult.set(r);this.notice('Vos réponses ont été enregistrées.');},error:e=>this.error(e)});}
  submitWork(a:Assignment):void{const content=this.submissionDraft[a.id]?.trim();if(!content)return this.notice('Rédigez votre réponse avant de la remettre.',true);this.busy.set(true);this.api.submitAssignment(a.id,content).subscribe({next:()=>{this.busy.set(false);this.api.assignments(this.id).subscribe(x=>this.setAssignments(x));this.notice('Travail remis avec succès.',false,'success-checkmark');},error:e=>this.error(e)});}
  loadSubmissions(a:Assignment):void{this.selectedAssignmentId.set(a.id);this.api.submissions(a.id).subscribe({next:items=>{this.submissions.set(items);for(const s of items){this.gradeDraft[s.id]=s.score??0;this.feedbackDraft[s.id]=s.feedback||'';}},error:e=>this.error(e)});}
  saveGrade(sub:Submission):void{this.api.grade(sub.id,this.gradeDraft[sub.id],this.feedbackDraft[sub.id]||'').subscribe({next:()=>{this.notice('Correction enregistrée.');const a=this.assignments().find(a=>a.id===this.selectedAssignmentId());if(a)this.loadSubmissions(a);},error:e=>this.error(e)});}
  private setAssignments(items:Assignment[]):void {
    this.assignments.set(items);
    for(const a of items)if(a.submission && this.submissionDraft[a.id]===undefined)this.submissionDraft[a.id]=a.submission.content;
  }
  selectQuizzes():void {this.tab.set('quiz');if(this.managing())this.loadQuizAttempts();}
  loadQuizAttempts():void {
    if(!this.managing())return;
    this.attemptsLoading.set(true);this.attemptsError.set('');
    this.api.quizAttempts(this.id).subscribe({next:items=>{this.quizAttempts.set(items);this.attemptsLoading.set(false);},error:()=>{this.attemptsLoading.set(false);this.attemptsError.set('Impossible de charger les résultats.');}});
  }
  selectStudents():void {
    if(!this.managing())return;
    this.tab.set('etudiants');this.studentsLoading.set(true);this.studentsError.set('');
    this.api.students(this.id).subscribe({next:items=>{this.students.set(items);this.studentsLoading.set(false);},error:()=>{this.studentsLoading.set(false);this.studentsError.set('Impossible de charger le suivi.');}});
  }
}
