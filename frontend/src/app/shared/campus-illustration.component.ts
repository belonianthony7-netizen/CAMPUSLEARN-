import { Component, Input, OnChanges, ChangeDetectionStrategy } from '@angular/core';

/** The onerror fallback ensures an illustration never renders as a broken image. */
@Component({selector:'app-campus-illustration',standalone:true,changeDetection:ChangeDetectionStrategy.OnPush,template:`
  <img [src]="displaySrc" [alt]="alt" [attr.loading]="priority?'eager':'lazy'" [attr.fetchpriority]="priority?'high':null" [attr.width]="width" [attr.height]="height" (error)="useFallback()" decoding="async" />
`,styles:[`:host{display:block;min-width:0}img{display:block;width:100%;height:100%;object-fit:contain} :host(.fit-cover) img{object-fit:cover}`]})
export class CampusIllustrationComponent implements OnChanges {
  @Input({required:true}) src='';
  @Input() remote="";
  @Input() fallback='/assets/illustrations/course-general.svg';
  @Input() alt='';
  @Input() priority=false;
  @Input() width=480;
  @Input() height=320;
  displaySrc='';
  private phase: "primary"|"remote"|"fallback"="primary";
  ngOnChanges():void {this.phase="primary";this.displaySrc=this.src || this.fallback;}
  useFallback():void {
    if (this.phase==="primary" && this.remote && this.remote!==this.src){this.phase="remote";this.displaySrc=this.remote;}
    else if(this.phase!=="fallback"){this.phase="fallback";this.displaySrc=this.fallback;}
  }
}
