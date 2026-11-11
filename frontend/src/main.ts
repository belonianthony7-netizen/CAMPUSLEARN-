import { provideLucideIcons, LucideArrowLeft, LucideArrowRight, LucideArrowUpRight, LucideBell, LucideBookOpen, LucideCalendarDays, LucideClapperboard, LucideChartNoAxesCombined, LucideCheck, LucideChevronRight, LucideCircleAlert, LucideCircleCheck, LucideCirclePlay, LucideClock, LucideCompass, LucideDownload, LucideExternalLink, LucideEye, LucideEyeOff, LucideFilePenLine, LucideFileText, LucideFolderOpen, LucideGraduationCap, LucideHeart, LucideHouse, LucideImage, LucideImages, LucideInfo, LucideList, LucideLoaderCircle, LucideLockKeyhole, LucideLogOut, LucideMail, LucideMegaphone, LucideMenu, LucideMessageCircle, LucideMessagesSquare, LucidePencilLine, LucidePlay, LucidePlus, LucideSave, LucideSearch, LucideSend, LucideSettings, LucideShieldCheck, LucideSparkles, LucideSquareCheck, LucideStar, LucideUserRound, LucideVideo, LucideUsersRound, LucideX } from '@lucide/angular';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';
import { authInterceptor } from './app/core/auth.interceptor';

bootstrapApplication(AppComponent, {
  providers: [
    provideLucideIcons(
      LucideArrowLeft,
      LucideArrowRight,
      LucideArrowUpRight,
      LucideBell,
      LucideBookOpen,
      LucideCalendarDays,
      LucideClapperboard,
      LucideChartNoAxesCombined,
      LucideCheck,
      LucideChevronRight,
      LucideCircleAlert,
      LucideCircleCheck,
      LucideCirclePlay,
      LucideClock,
      LucideCompass,
      LucideDownload,
      LucideExternalLink,
      LucideEye,
      LucideEyeOff,
      LucideFilePenLine,
      LucideFileText,
      LucideFolderOpen,
      LucideGraduationCap,
      LucideHeart,
      LucideHouse,
      LucideImage,
      LucideImages,
      LucideInfo,
      LucideList,
      LucideLoaderCircle,
      LucideLockKeyhole,
      LucideLogOut,
      LucideMail,
      LucideMegaphone,
      LucideMenu,
      LucideMessageCircle,
      LucideMessagesSquare,
      LucidePencilLine,
      LucidePlay,
      LucidePlus,
      LucideSave,
      LucideSearch,
      LucideSend,
      LucideSettings,
      LucideShieldCheck,
      LucideSparkles,
      LucideSquareCheck,
      LucideStar,
      LucideUserRound,
      LucideVideo,
      LucideUsersRound,
      LucideX
    ),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([authInterceptor]))
  ]
}).catch(console.error);
