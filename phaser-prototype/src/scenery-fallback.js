// The built-in backdrop: five painted SVG scenes with drifting CSS particles.
// It is what the player sees when Phaser (WebGL) is not available or fails to
// start; while Phaser draws the world this stays out of the way. The scenes
// are plain data; createFallbackScenery() puts them on the page.
//
// EVOLVING ENVIRONMENT - Japanese countryside, 5 stages
// SVG layers + CSS crossfades + drifting particles.

export const STAGE_SVG = [
  // Stage 1 — Radical Winter Mountain Overlook (asymmetrical high-altitude summit POV plunging into a deep valley)
  `<defs>
    <linearGradient id="s1sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#7291aa"/>
      <stop offset="50%" stop-color="#b0d6eb"/>
      <stop offset="100%" stop-color="#e2f0f7"/>
    </linearGradient>
    <linearGradient id="s1valleyfog" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#cae0ee" stop-opacity="0.8"/>
      <stop offset="100%" stop-color="#cae0ee" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="s1ridgeGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1c2b38"/>
      <stop offset="50%" stop-color="#2d4052"/>
      <stop offset="100%" stop-color="#475f75"/>
    </linearGradient>
    <linearGradient id="s1snowGrad" x1="0" y1="0" x2="0.3" y2="1">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="60%" stop-color="#e6f2fa"/>
      <stop offset="100%" stop-color="#b8d4e8"/>
    </linearGradient>
    <linearGradient id="s1lake" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#a4c6de" stop-opacity="0.85"/>
      <stop offset="100%" stop-color="#d4e8f5" stop-opacity="0.95"/>
    </linearGradient>
  </defs>

  <!-- Frosty Winter Sky & Soft Sun -->
  <rect width="1440" height="900" fill="url(#s1sky)"/>
  <circle cx="1120" cy="160" r="75" fill="#ffffff" opacity="0.35"/>
  <g opacity="0.12" class="env-rays">
    <polygon points="1120,160 450,900 720,900" fill="#ffffff"/>
    <polygon points="1120,160 800,900 1050,900" fill="#ffffff"/>
  </g>

  <!-- Layered alpine ridges with irregular shoulders and naturally broken snow lines. -->
  <path d="M0 430 Q58 356 122 282 Q166 318 218 366 Q304 314 394 238 Q465 286 574 352 Q662 305 758 258 Q844 303 974 371 Q1070 319 1194 252 Q1277 292 1440 360 L1440 620 L0 620Z" fill="#5c7a94" opacity="0.4"/>
  <path d="M104 302 Q120 280 136 300 L162 330 L191 313 L221 366 Q174 337 145 326 Q126 315 104 302Z" fill="#fff" opacity=".74"/>
  <path d="M365 264 Q394 238 421 261 L452 292 L485 272 Q520 313 574 352 Q505 320 459 301 Q414 284 365 264Z" fill="#fff" opacity=".84"/>
  <path d="M726 276 Q758 258 784 276 L813 311 L846 291 Q897 333 974 371 Q884 336 826 320 Q782 301 726 276Z" fill="#fff" opacity=".78"/>
  <path d="M1154 275 Q1194 252 1228 273 L1255 302 L1292 283 Q1354 327 1440 360 Q1346 329 1279 315 Q1220 295 1154 275Z" fill="#fff" opacity=".83"/>

  <path d="M0 486 Q85 425 178 361 Q263 398 377 442 Q478 390 616 321 Q711 365 855 421 Q966 374 1118 331 Q1220 374 1358 411 Q1402 391 1440 382 L1440 680 L0 680Z" fill="#446078" opacity="0.55"/>
  <path d="M148 383 Q178 361 204 377 L231 410 L275 392 Q316 420 377 442 Q299 414 247 416 Q207 399 148 383Z" fill="#fff" opacity=".72"/>
  <path d="M575 343 Q616 321 650 342 L683 381 L727 361 Q777 395 855 421 Q765 394 706 389 Q657 370 575 343Z" fill="#fff" opacity=".78"/>
  <path d="M1078 348 Q1118 331 1150 350 L1181 390 L1226 371 Q1280 397 1358 411 Q1267 396 1204 401 Q1153 375 1078 348Z" fill="#fff" opacity=".72"/>

  <!-- Deep Valley Basin & Frozen Glacial Lake -->
  <path d="M220 900 Q620 580 1440 540 L1440 900 Z" fill="#7593ab"/>
  <ellipse cx="980" cy="620" rx="380" ry="45" fill="url(#s1lake)"/>
  <g fill="none" stroke-linecap="round">
    <path d="M716 616 Q802 600 883 610 T1056 605" stroke="#f5fbff" stroke-width="3" opacity=".38"/>
    <path d="M820 630 L861 616 L897 628 L938 612 M897 628 L915 642 M861 616 L850 603" stroke="#789db7" stroke-width="2" opacity=".42"/>
    <path d="M1080 620 L1111 609 L1142 620 M1111 609 L1120 596" stroke="#799db6" stroke-width="1.7" opacity=".34"/>
    <ellipse cx="1005" cy="634" rx="48" ry="7" stroke="#fff" stroke-width="2" opacity=".22"/>
  </g>
  <g fill="#eff8fd" opacity=".48"><circle cx="760" cy="629" r="3"/><circle cx="778" cy="618" r="2"/><circle cx="964" cy="615" r="2.5"/><circle cx="1162" cy="624" r="3"/></g>
  <rect x="0" y="500" width="1440" height="180" fill="url(#s1valleyfog)" class="env-mist"/>

  <!-- Distant Shrinking Tree Clusters on Valley Spurs (Perspective Scaling) -->
  <g transform="translate(920, 560) scale(0.35)">
    <polygon points="0,-40 -18,10 -6,10 -24,40 24,40 6,10 18,10" fill="#2c3e4d"/>
    <polygon points="0,-40 -12,0 0,-5 12,0" fill="#ffffff" opacity="0.85"/>
    <polygon points="40,-30 25,10 33,10 20,35 60,35 47,10 55,10" fill="#2c3e4d"/>
    <polygon points="40,-30 30,0 40,-4 50,0" fill="#ffffff" opacity="0.85"/>
  </g>
  <g transform="translate(1220, 575) scale(0.45)">
    <polygon points="0,-40 -18,10 -6,10 -24,40 24,40 6,10 18,10" fill="#243442"/>
    <polygon points="0,-40 -12,0 0,-5 12,0" fill="#ffffff" opacity="0.85"/>
  </g>
  <!-- A quiet deer silhouette gives the frozen basin a distant sense of life. -->
  <g transform="translate(1065 552) scale(.42)" fill="#2b4050" opacity=".78">
    <ellipse cx="0" cy="7" rx="30" ry="15"/><path d="M22 2 Q31 -17 43 -27 L52 -22 Q43 -7 38 9Z"/>
    <ellipse cx="48" cy="-27" rx="11" ry="8"/><path d="M43 -33 L36 -46 L44 -39 L47 -52 M52 -33 L60 -45 L57 -36 L67 -42" stroke="#2b4050" stroke-width="4" fill="none" stroke-linecap="round"/>
    <path d="M-20 15 L-24 48 M-4 17 L-7 49 M16 16 L20 47 M28 12 L32 44" stroke="#2b4050" stroke-width="6" stroke-linecap="round"/>
    <path d="M-29 2 L-42 -8 L-34 9Z"/>
  </g>

  <!-- Midground Right Mountain Spur (Sloping Downward into Valley) -->
  <path d="M760 900 Q1020 590 1440 580 L1440 900 Z" fill="#364b5e"/>
  <path d="M800 900 Q1040 610 1440 600 L1440 900 Z" fill="url(#s1snowGrad)"/>

  <!-- FOREGROUND: Massive Asymmetrical Left Summit Ridge (High Overlook Vantage Point) -->
  <path d="M0 900 L0 260 Q220 480 660 900 Z" fill="url(#s1ridgeGrad)"/>
  <!-- Exposed Slate Rock Ledges -->
  <path d="M0 420 Q180 520 520 880 L440 900 Q140 550 0 470 Z" fill="#141f28"/>
  <!-- Wind-Carved Layered Snowdrifts & Contours -->
  <path d="M0 260 Q190 420 580 840 Q380 880 0 490 Z" fill="url(#s1snowGrad)"/>
  <path d="M0 340 Q150 450 460 780 Q320 820 0 410 Z" fill="#ffffff" opacity="0.9"/>
  <!-- Shaded Snow Contour Trough -->
  <path d="M40 360 Q170 480 440 760 Q340 790 20 380 Z" fill="#a4c4dc" opacity="0.6"/>

  <!-- Large Foreground Wind-Bent Frosted Fir Trees (Rooted on Summit Ridge) -->
  <g transform="translate(100, 360) rotate(-4)">
    <polygon points="0,-75 -30,15 -10,15 -38,65 38,65 10,15 30,15" fill="#182430"/>
    <polygon points="0,-75 -18,0 0,-10 18,0" fill="#ffffff" opacity="0.95"/>
    <polygon points="-10,15 -24,48 24,48 10,15" fill="#ffffff" opacity="0.85"/>
    <polygon points="-14,35 -28,60 28,60 14,35" fill="#ffffff" opacity="0.75"/>
  </g>
  <g transform="translate(180, 440) rotate(3)">
    <polygon points="0,-66 -20,-5 -7,-10 -33,46 -11,38 -39,58 31,58 10,34 25,39 8,-2 23,4" fill="#141f28"/>
    <path d="M0 -66 L-13 -9 L0 -16 L15 -4 L22 3 L8 -2Z" fill="#fff" opacity=".94"/>
    <path d="M-8 10 L-24 41 L-8 35 L20 39 L9 14Z" fill="#fff" opacity=".8"/>
  </g>
  <g transform="translate(250, 530) rotate(-7) scale(.92 1.08)">
    <polygon points="0,-46 -16,4 -5,0 -25,38 -9,32 -28,46 24,46 8,27 19,31 6,2 18,7" fill="#182430"/>
    <path d="M0 -46 L-10 -2 L1 -8 L14 1 L18 7 L6 2Z" fill="#fff" opacity=".94"/>
    <path d="M-6 10 L-17 31 L-7 27 L16 30 L7 12Z" fill="#fff" opacity=".8"/>
  </g>

  <g fill="none" stroke="#33495a" stroke-linecap="round">
    <path d="M298 575 Q305 552 315 574 M306 562 L297 550 M309 559 L320 548" stroke-width="4"/>
    <path d="M1320 606 Q1326 586 1334 605 M1326 593 L1318 584" stroke-width="3" opacity=".8"/>
  </g>
  <g transform="translate(315 583) rotate(8)"><path d="M-30 0 Q0 -9 32 0" stroke="#4b382d" stroke-width="8" fill="none" stroke-linecap="round"/><path d="M-23 -3 Q0 -9 22 -3" stroke="#f4f9fc" stroke-width="4" fill="none" opacity=".85"/></g>

  <!-- Friendly snowman on the open right-hand snowfield. -->
  <g transform="translate(1215 700)">
    <ellipse cx="0" cy="94" rx="76" ry="16" fill="#66859d" opacity=".3"/>
    <ellipse cx="0" cy="55" rx="60" ry="62" fill="#e5f1f8"/>
    <ellipse cx="-15" cy="34" rx="34" ry="38" fill="#ffffff" opacity=".52"/>
    <circle cx="0" cy="-24" r="45" fill="#edf6fb"/>
    <ellipse cx="-12" cy="-38" rx="24" ry="19" fill="#ffffff" opacity=".55"/>

    <g fill="none" stroke="#4a382d" stroke-width="7" stroke-linecap="round">
      <path d="M-49 22 Q-78 1 -99 -24 M-99 -24 L-119 -13 M-99 -24 L-103 -48"/>
      <path d="M49 18 Q77 -5 97 -29 M97 -29 L118 -18 M97 -29 L101 -53"/>
    </g>

    <path d="M-39 -2 Q0 12 39 -2 L34 18 Q0 28 -34 16Z" fill="#c94d5f"/>
    <path d="M29 12 Q51 39 43 71 L25 56 L32 24Z" fill="#a9364d"/>
    <path d="M-41 -68 H40 L32 -91 H-26Z" fill="#263746"/>
    <rect x="-50" y="-73" width="100" height="13" rx="5" fill="#1a2834"/>
    <rect x="-26" y="-86" width="58" height="7" fill="#d8e6ef" opacity=".42"/>

    <g fill="#25333d"><circle cx="-15" cy="-34" r="5"/><circle cx="16" cy="-34" r="5"/></g>
    <path d="M2 -23 L38 -14 L2 -8Z" fill="#ed8d32"/>
    <path d="M-18 -2 Q0 10 19 -2" stroke="#344550" stroke-width="4" fill="none" stroke-linecap="round"/>
    <g fill="#364751"><circle cy="39" r="5"/><circle cy="62" r="5"/></g>

    <g fill="#ffffff" opacity=".78">
      <circle cx="-31" cy="-47" r="3"/><circle cx="22" cy="15" r="3.5"/><circle cx="-36" cy="48" r="4"/>
    </g>
  </g>`,

  // Stage 2 — Snowmelt / Early Spring: descended into a Swiss alpine valley.
  // Cool pale sky, leftover snow, thawing soil, icy meltwater. Not lush, not floral.
  `<defs>
    <linearGradient id="s2sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#78a9c9"/>
      <stop offset="42%" stop-color="#bed8e3"/>
      <stop offset="78%" stop-color="#dff0ec"/>
      <stop offset="100%" stop-color="#f0f3df"/>
    </linearGradient>
    <radialGradient id="s2sun" cx="0.78" cy="0.16" r="0.28">
      <stop offset="0%" stop-color="#fff7e4" stop-opacity="0.85"/>
      <stop offset="45%" stop-color="#f0e6c8" stop-opacity="0.28"/>
      <stop offset="100%" stop-color="#f0e6c8" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="s2haze" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#d5e0e6" stop-opacity="0.7"/>
      <stop offset="100%" stop-color="#d5e0e6" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="s2stream" x1="0" y1="0" x2="0.2" y2="1">
      <stop offset="0%" stop-color="#9bb8c8" stop-opacity="0.75"/>
      <stop offset="55%" stop-color="#6f93a8" stop-opacity="0.88"/>
      <stop offset="100%" stop-color="#4d7388" stop-opacity="0.95"/>
    </linearGradient>
    <linearGradient id="s2meadow1" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#91b875"/>
      <stop offset="100%" stop-color="#a9c783"/>
    </linearGradient>
    <linearGradient id="s2meadow2" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#7fa565"/>
      <stop offset="100%" stop-color="#91b36f"/>
    </linearGradient>
    <linearGradient id="s2meadow3" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#6f9559"/>
      <stop offset="100%" stop-color="#82a667"/>
    </linearGradient>
    <linearGradient id="s2soil" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#6b5340" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="#4a382c" stop-opacity="0.7"/>
    </linearGradient>
  </defs>

  <rect width="1440" height="900" fill="url(#s2sky)"/>
  <circle cx="1120" cy="145" r="150" fill="url(#s2sun)"/>
  <circle cx="1120" cy="145" r="38" fill="#fff6e0" opacity="0.7"/>
  <g class="env-clouds" fill="#eef3f6">
    <path d="M70 155 Q105 128 150 138 Q190 118 235 142 Q265 132 285 155 Q292 175 262 182 L90 182 Z" opacity="0.55"/>
    <path d="M680 128 Q715 102 760 112 Q800 92 848 118 Q878 108 898 130 Q908 150 878 158 L700 158 Z" opacity="0.42"/>
  </g>

  <path d="M0 455 L90 360 L170 410 L280 300 L390 390 L520 270 L640 365 L780 255 L920 350 L1060 280 L1200 355 L1320 290 L1440 360 L1440 560 L0 560Z" fill="#6d8494" opacity="0.55"/>
  <path d="M280 300 L318 355 L248 355 Z" fill="#f4f8fb" opacity="0.88"/>
  <path d="M520 270 L562 332 L478 332 Z" fill="#ffffff" opacity="0.92"/>
  <path d="M780 255 L828 328 L732 328 Z" fill="#ffffff" opacity="0.9"/>
  <path d="M1060 280 L1100 335 L1020 335 Z" fill="#f4f8fb" opacity="0.82"/>
  <path d="M1320 290 L1360 340 L1280 340 Z" fill="#eef4f8" opacity="0.78"/>

  <path d="M0 505 L160 430 L340 475 L530 410 L740 460 L960 405 L1180 455 L1440 420 L1440 620 L0 620Z" fill="#6f8d72" opacity="0.72"/>
  <path d="M200 455 Q260 442 310 462 Q250 472 200 455 Z" fill="#e8eef2" opacity="0.55"/>
  <path d="M560 430 Q630 416 690 438 Q620 448 560 430 Z" fill="#e8eef2" opacity="0.48"/>
  <path d="M1020 428 Q1090 412 1160 436 Q1085 446 1020 428 Z" fill="#dfe7ea" opacity="0.5"/>

  <path d="M0 555 Q380 508 760 538 T1440 518 L1440 900 L0 900Z" fill="url(#s2meadow1)"/>
  <path d="M0 628 Q360 582 780 612 T1440 592 L1440 900 L0 900Z" fill="url(#s2meadow2)"/>
  <path d="M0 718 Q400 672 820 702 T1440 682 L1440 900 L0 900Z" fill="url(#s2meadow3)"/>

  <path d="M40 640 Q120 618 190 648 Q110 662 40 640 Z" fill="#f2f6f8" opacity="0.72"/>
  <path d="M980 600 Q1060 582 1145 612 Q1055 624 980 600 Z" fill="#eef3f6" opacity="0.58"/>
  <path d="M420 700 Q490 684 545 708 Q475 718 420 700 Z" fill="#f7fafb" opacity="0.4"/>

  <rect x="0" y="470" width="1440" height="160" fill="url(#s2haze)" class="env-mist"/>

  <path d="M90 900 Q250 775 400 705 T660 625 T830 565 T960 518 L990 522 Q860 570 T690 632 T430 712 T270 785 T120 900 Z" fill="url(#s2soil)"/>

  <path class="env-stream" d="M110 900 Q255 778 405 708 T665 628 T835 568 T965 522 L978 526 Q848 572 T678 634 T418 714 T268 788 L125 900 Z" fill="url(#s2stream)"/>
  <path class="env-s2-waterline" d="M128 900 Q268 778 418 708 T678 628 T848 568 T972 524" stroke="#f4fbff" stroke-width="3" fill="none" opacity="0.58" stroke-linecap="round"/>
  <path class="env-s2-waterline" d="M142 888 Q275 770 422 702 T680 624" stroke="#c5e4ef" stroke-width="1.8" fill="none" opacity="0.42" style="animation-delay:-2s"/>
  <g class="env-s2-ripple" fill="none" stroke="#e9f7fb" stroke-width="2" opacity=".45">
    <ellipse cx="366" cy="744" rx="38" ry="7"/><ellipse cx="585" cy="652" rx="27" ry="5"/><ellipse cx="812" cy="575" rx="18" ry="3.5"/>
  </g>

  <!-- Two bank frogs hop at offset rhythms so the stream feels inhabited. -->
  <g transform="translate(300 790)">
    <ellipse class="env-frog-shadow" cx="0" cy="8" rx="18" ry="5" fill="#36583a" opacity=".3"/>
    <g class="env-frog-hop">
      <ellipse cx="0" cy="0" rx="15" ry="10" fill="#5f9b50"/>
      <circle cx="-9" cy="-8" r="6" fill="#75b962"/><circle cx="9" cy="-8" r="6" fill="#75b962"/>
      <circle cx="-9" cy="-9" r="2" fill="#18271a"/><circle cx="9" cy="-9" r="2" fill="#18271a"/>
      <g class="env-frog-blink" fill="#75b962"><circle cx="-9" cy="-9" r="2.6"/><circle cx="9" cy="-9" r="2.6"/></g>
      <path d="M-11 5 L-24 12 M11 5 L24 12 M-8 8 L-17 19 M8 8 L17 19" stroke="#4d8245" stroke-width="4" stroke-linecap="round"/>
      <ellipse class="env-frog-throat" cx="0" cy="7" rx="8" ry="5" fill="#b7d681"/>
      <path d="M-5 2 Q0 6 5 2" stroke="#d9eaa9" stroke-width="1.5" fill="none"/>
    </g>
  </g>
  <g transform="translate(1008 555) scale(.72)">
    <ellipse class="env-frog-shadow env-frog-shadow-late" cx="0" cy="8" rx="18" ry="5" fill="#36583a" opacity=".28"/>
    <g class="env-frog-hop env-frog-hop-late env-frog-late">
      <ellipse cx="0" cy="0" rx="15" ry="10" fill="#639d52"/>
      <circle cx="-9" cy="-8" r="6" fill="#7cba63"/><circle cx="9" cy="-8" r="6" fill="#7cba63"/>
      <circle cx="-9" cy="-9" r="2" fill="#18271a"/><circle cx="9" cy="-9" r="2" fill="#18271a"/>
      <g class="env-frog-blink" fill="#7cba63"><circle cx="-9" cy="-9" r="2.6"/><circle cx="9" cy="-9" r="2.6"/></g>
      <path d="M-11 5 L-24 12 M11 5 L24 12 M-8 8 L-17 19 M8 8 L17 19" stroke="#4f8445" stroke-width="4" stroke-linecap="round"/>
      <ellipse class="env-frog-throat" cx="0" cy="7" rx="8" ry="5" fill="#bdd987"/>
    </g>
  </g>

  <!-- A small alpine homestead gives the thawing valley a warm focal point. -->
  <g transform="translate(1010 505)">
    <rect x="0" y="18" width="92" height="58" rx="3" fill="#d8b37b"/>
    <path d="M-12 22 L45 -18 L104 22 Z" fill="#7d4634"/>
    <rect x="38" y="43" width="20" height="33" rx="2" fill="#6b4932"/>
    <rect x="10" y="37" width="18" height="16" rx="2" fill="#f4dca0"/>
    <rect x="68" y="37" width="18" height="16" rx="2" fill="#f4dca0"/>
    <path d="M92 8 Q105 -6 116 8" stroke="#eef3f5" stroke-width="6" fill="none" opacity=".55"/>
  </g>
  <g transform="translate(736 602) rotate(-8)">
    <path d="M-50 0 Q0 -20 50 0" stroke="#76543a" stroke-width="10" fill="none"/>
    <path d="M-48 -4 Q0 -24 48 -4" stroke="#c39862" stroke-width="5" fill="none"/>
    <path d="M-38 -2 V24 M38 -2 V24" stroke="#60432f" stroke-width="5"/>
  </g>

  <g fill="#355246" opacity="0.58">
    <polygon points="610,478 601,508 619,508"/><polygon points="632,472 623,504 641,504"/>
  </g>

  <g transform="translate(68, 605) scale(0.82)" class="env-fg-sway">
    <path d="M0 82 Q-5 20 4 -62 M0 -5 Q-34 -30 -58 -64 M2 -18 Q38 -46 62 -72" stroke="#775940" stroke-width="14" stroke-linecap="round" fill="none"/>
    <g fill="#78a35e"><circle cx="-58" cy="-65" r="35"/><circle cx="-24" cy="-86" r="40"/><circle cx="15" cy="-91" r="43"/><circle cx="57" cy="-70" r="36"/><circle cx="20" cy="-48" r="39"/></g>
    <g fill="#b2ca7f" opacity=".8"><circle cx="-32" cy="-96" r="16"/><circle cx="12" cy="-104" r="18"/><circle cx="51" cy="-76" r="15"/></g>
  </g>
  <g transform="translate(128, 690) scale(1.05)" class="env-fg-sway">
    <path d="M0 130 Q-8 50 -18 -20 Q-28 -80 -42 -150" stroke="#3a2a1c" stroke-width="15" stroke-linecap="round" fill="none"/>
    <path d="M-12 20 Q22 -30 58 -88" stroke="#3a2a1c" stroke-width="8" stroke-linecap="round" fill="none"/>
    <path d="M-22 -40 Q-4 -95 18 -148" stroke="#3a2a1c" stroke-width="6" stroke-linecap="round" fill="none"/>
    <path d="M-8 -10 Q-38 -40 -62 -28" stroke="#3a2a1c" stroke-width="5" fill="none"/>
    <circle cx="-42" cy="-148" r="7" fill="#7d9a58" opacity="0.85"/>
    <circle cx="-18" cy="-132" r="6" fill="#8aaa62" opacity="0.75"/>
    <circle cx="12" cy="-142" r="6.5" fill="#7d9a58" opacity="0.8"/>
    <circle cx="52" cy="-86" r="6" fill="#8aaa62" opacity="0.7"/>
    <circle cx="-58" cy="-30" r="5" fill="#6f8c4e" opacity="0.7"/>
    <circle cx="-8" cy="-70" r="5" fill="#8aaa62" opacity="0.65"/>
  </g>
  <g transform="translate(248, 548) scale(0.5)" class="env-fg-sway">
    <path d="M0 58 Q2 4 -4 -78 M-2 -12 Q-34 -35 -48 -58 M-2 -30 Q28 -52 44 -72" stroke="#e4e0d2" stroke-width="13" stroke-linecap="round" fill="none"/>
    <g fill="#88ad69"><circle cx="-46" cy="-60" r="29"/><circle cx="-14" cy="-82" r="34"/><circle cx="20" cy="-83" r="35"/><circle cx="46" cy="-66" r="28"/></g>
  </g>
  <g transform="translate(300, 575) scale(0.48)" class="env-fg-sway">
    <path d="M0 90 Q-6 30 -14 -40 Q-20 -80 -28 -118" stroke="#3a2a1c" stroke-width="9" fill="none"/>
    <path d="M-10 10 Q18 -20 40 -55" stroke="#3a2a1c" stroke-width="5" fill="none"/>
    <circle cx="-28" cy="-118" r="5" fill="#7d9a58" opacity="0.7"/>
    <circle cx="8" cy="-95" r="4.5" fill="#8aaa62" opacity="0.65"/>
    <circle cx="38" cy="-52" r="4" fill="#7d9a58" opacity="0.6"/>
  </g>

  <g transform="translate(1248, 698) scale(1.08)" class="env-fg-sway">
    <path d="M0 88 Q-2 22 2 -50 M0 12 Q-42 -24 -66 -60 M2 -12 Q42 -46 72 -78" stroke="#76563d" stroke-width="15" stroke-linecap="round" fill="none"/>
    <g fill="#6f9d58"><circle cx="-66" cy="-62" r="38"/><circle cx="-30" cy="-86" r="44"/><circle cx="12" cy="-96" r="48"/><circle cx="58" cy="-77" r="42"/><circle cx="25" cy="-45" r="46"/></g>
    <g fill="#a8c77b" opacity=".82"><circle cx="-44" cy="-99" r="19"/><circle cx="4" cy="-113" r="22"/><circle cx="52" cy="-87" r="18"/><circle cx="-4" cy="-57" r="16"/></g>
  </g>
  <g transform="translate(1378, 628) scale(0.72)" class="env-fg-sway">
    <path d="M0 70 Q2 12 -5 -68 M-1 -5 Q-35 -28 -52 -55" stroke="#75573f" stroke-width="13" stroke-linecap="round" fill="none"/>
    <g fill="#82a965"><circle cx="-52" cy="-57" r="31"/><circle cx="-20" cy="-76" r="37"/><circle cx="18" cy="-73" r="35"/><circle cx="42" cy="-48" r="28"/></g>
  </g>
  <g transform="translate(1148, 618) scale(0.78)" class="env-fg-sway">
    <path d="M0 115 Q-8 42 -16 -18 Q-24 -70 -38 -118" stroke="#3e2e20" stroke-width="12" stroke-linecap="round" fill="none"/>
    <path d="M-10 18 Q22 -22 52 -70" stroke="#3e2e20" stroke-width="7" fill="none"/>
    <circle cx="-38" cy="-116" r="6" fill="#7d9a58" opacity="0.8"/>
    <circle cx="-8" cy="-98" r="5" fill="#8aaa62" opacity="0.7"/>
    <circle cx="48" cy="-68" r="5.5" fill="#7d9a58" opacity="0.72"/>
    <circle cx="12" cy="-50" r="4.5" fill="#6f8c4e" opacity="0.65"/>
  </g>
  <g transform="translate(1072, 538) scale(0.46)" class="env-fg-sway">
    <path d="M0 80 Q-6 28 -12 -30 Q-18 -70 -26 -102" stroke="#3e2e20" stroke-width="8" fill="none"/>
    <circle cx="-26" cy="-100" r="4.5" fill="#7d9a58" opacity="0.65"/>
    <circle cx="6" cy="-72" r="4" fill="#8aaa62" opacity="0.6"/>
  </g>

  <!-- Mixed early-spring broadleaf trees soften the conifer-heavy valley. -->
  <g transform="translate(365 610)" class="env-fg-sway">
    <path d="M0 74 Q5 12 -8 -72 M-2 10 Q-38 -18 -55 -52 M-5 -18 Q28 -40 43 -70" stroke="#806046" stroke-width="10" stroke-linecap="round" fill="none"/>
    <g fill="#86ad68"><circle cx="-55" cy="-55" r="25"/><circle cx="-25" cy="-70" r="30"/><circle cx="8" cy="-80" r="34"/><circle cx="42" cy="-67" r="27"/><circle cx="20" cy="-42" r="31"/></g>
    <g fill="#b3cc83" opacity=".8"><circle cx="-36" cy="-78" r="13"/><circle cx="4" cy="-91" r="15"/><circle cx="38" cy="-73" r="12"/></g>
  </g>
  <g transform="translate(1180 650) scale(.9)" class="env-fg-sway">
    <path d="M0 92 Q-2 25 8 -72 M5 0 Q-28 -26 -48 -58 M7 -18 Q42 -42 57 -70" stroke="#795b43" stroke-width="11" stroke-linecap="round" fill="none"/>
    <g fill="#78a45f"><circle cx="-48" cy="-60" r="27"/><circle cx="-16" cy="-79" r="31"/><circle cx="18" cy="-82" r="35"/><circle cx="53" cy="-65" r="28"/><circle cx="22" cy="-43" r="33"/></g>
    <g fill="#abc97e" opacity=".78"><circle cx="-24" cy="-88" r="14"/><circle cx="17" cy="-94" r="16"/><circle cx="49" cy="-69" r="12"/></g>
  </g>

  <!-- Acacia: airy, horizontally spreading crown with fresh compound foliage. -->
  <g transform="translate(190 665) scale(1.12)">
    <g class="env-fg-sway">
    <path d="M0 105 Q-2 35 8 -36 M5 10 Q-48 -20 -91 -48 M8 -12 Q56 -38 104 -45 M-18 -5 Q-52 -52 -58 -82" stroke="#76563d" stroke-width="14" stroke-linecap="round" fill="none"/>
    <g fill="#83ad63">
      <ellipse cx="-92" cy="-51" rx="39" ry="23"/><ellipse cx="-55" cy="-66" rx="43" ry="25"/><ellipse cx="-12" cy="-70" rx="42" ry="27"/>
      <ellipse cx="35" cy="-62" rx="44" ry="25"/><ellipse cx="80" cy="-51" rx="39" ry="23"/><ellipse cx="111" cy="-43" rx="29" ry="18"/>
    </g>
    <g fill="#b7d285" opacity=".82"><ellipse cx="-72" cy="-76" rx="24" ry="12"/><ellipse cx="-24" cy="-88" rx="25" ry="13"/><ellipse cx="31" cy="-78" rx="26" ry="13"/><ellipse cx="83" cy="-62" rx="22" ry="11"/></g>
    <g fill="#f2efd0" opacity=".82"><circle cx="-61" cy="-63" r="3"/><circle cx="-35" cy="-79" r="2.5"/><circle cx="22" cy="-68" r="3"/><circle cx="65" cy="-54" r="2.5"/></g>
    </g>
  </g>

  <!-- Hornbeam: denser upright oval crown with layered spring leaves. -->
  <g transform="translate(1250 680) scale(1.12)">
    <g class="env-fg-sway">
    <path d="M0 104 Q4 30 -2 -62 M0 18 Q-32 -12 -48 -52 M1 -6 Q34 -36 48 -70" stroke="#70604c" stroke-width="15" stroke-linecap="round" fill="none"/>
    <g fill="#719a59"><ellipse cx="-35" cy="-61" rx="36" ry="43"/><ellipse cx="0" cy="-88" rx="43" ry="51"/><ellipse cx="36" cy="-65" rx="37" ry="45"/><ellipse cx="3" cy="-43" rx="48" ry="40"/></g>
    <g fill="#9fc276" opacity=".86"><ellipse cx="-20" cy="-97" rx="20" ry="26"/><ellipse cx="14" cy="-111" rx="19" ry="25"/><ellipse cx="38" cy="-77" rx="18" ry="23"/><ellipse cx="-5" cy="-52" rx="22" ry="18"/></g>
    <g fill="#c5d995" opacity=".68"><ellipse cx="-25" cy="-80" rx="10" ry="15"/><ellipse cx="8" cy="-95" rx="11" ry="16"/><ellipse cx="26" cy="-54" rx="10" ry="14"/></g>
    </g>
  </g>

  <!-- Sparse snowdrop, crocus and primrose clusters: spring has just arrived. -->
  <g opacity=".92">
    <g transform="translate(180 755)"><path d="M0 18 V0 M14 18 V4 M28 18 V-2" stroke="#4f7d45" stroke-width="3"/><ellipse cx="0" cy="-3" rx="6" ry="4" fill="#fffdf4"/><ellipse cx="14" cy="1" rx="6" ry="4" fill="#d9e9ff"/><ellipse cx="28" cy="-5" rx="6" ry="4" fill="#fffdf4"/></g>
    <g transform="translate(1050 704)"><path d="M0 16 V0 M16 16 V-2 M32 16 V2" stroke="#4f7d45" stroke-width="3"/><circle cx="0" cy="-3" r="5" fill="#e8d8f2"/><circle cx="16" cy="-5" r="5" fill="#f4e39a"/><circle cx="32" cy="-1" r="5" fill="#f1d7ea"/></g>
    <g transform="translate(1285 790)"><path d="M0 18 V0 M18 18 V2 M36 18 V-3" stroke="#4f7d45" stroke-width="3"/><circle cx="0" cy="-3" r="5" fill="#fff6c1"/><circle cx="18" cy="-1" r="5" fill="#eee0f6"/><circle cx="36" cy="-6" r="5" fill="#fff6c1"/></g>
  </g>

  <!-- Foreground living frame: restrained new leaves, never over the board. -->
  <g class="env-s2-branch" transform="translate(-35 80)">
    <path d="M0 0 Q120 25 255 112 Q320 152 370 205" stroke="#4b3828" stroke-width="15" stroke-linecap="round" fill="none"/>
    <path d="M118 52 Q170 25 222 34 M210 95 Q270 78 320 94" stroke="#4b3828" stroke-width="7" stroke-linecap="round" fill="none"/>
    <g fill="#91aa68"><ellipse cx="166" cy="32" rx="14" ry="7" transform="rotate(-18 166 32)"/><ellipse cx="218" cy="38" rx="12" ry="6" transform="rotate(20 218 38)"/><ellipse cx="274" cy="76" rx="13" ry="7" transform="rotate(-12 274 76)"/><ellipse cx="321" cy="96" rx="11" ry="6" transform="rotate(24 321 96)"/></g>
    <g fill="#b5c987" opacity=".8"><ellipse cx="140" cy="48" rx="9" ry="5"/><ellipse cx="245" cy="70" rx="9" ry="5"/><ellipse cx="345" cy="137" rx="8" ry="4"/></g>
  </g>

  <g class="env-s2-grass" stroke="#58733f" stroke-width="5" stroke-linecap="round" fill="none">
    <path d="M18 900 Q30 842 48 808 M48 900 Q58 830 86 790 M82 900 Q96 846 118 820 M1260 900 Q1272 838 1290 804 M1300 900 Q1314 824 1340 786 M1350 900 Q1360 840 1390 812"/>
  </g>
  <g class="env-s2-grass slow" stroke="#769052" stroke-width="3.5" stroke-linecap="round" fill="none" opacity=".8">
    <path d="M210 900 Q218 860 236 836 M260 900 Q270 852 288 824 M1120 900 Q1130 852 1150 824 M1170 900 Q1182 858 1200 836"/>
  </g>

  <path d="M28 858 Q52 812 76 858 M48 858 Q68 800 92 858 M96 868 Q118 824 142 868" stroke="#4f6a3a" stroke-width="5.5" stroke-linecap="round" fill="none"/>
  <path d="M1228 848 Q1252 800 1276 848 M1248 848 Q1268 792 1292 848 M1298 858 Q1322 812 1346 858" stroke="#4f6a3a" stroke-width="5.5" stroke-linecap="round" fill="none"/>
  <path d="M668 728 Q688 690 708 728 M688 728 Q702 686 722 728" stroke="#4f6a3a" stroke-width="4" stroke-linecap="round" fill="none"/>
  <g transform="translate(236, 778)" opacity="0.85">
    <path d="M0 8 Q2 -10 0 -22" stroke="#4a6a38" stroke-width="2" fill="none"/>
    <ellipse cx="0" cy="-24" rx="3.5" ry="5" fill="#f4f6f2"/>
  </g>
  <g transform="translate(1092, 762)" opacity="0.75">
    <path d="M0 8 Q2 -8 1 -18" stroke="#4a6a38" stroke-width="2" fill="none"/>
    <ellipse cx="1" cy="-20" rx="3" ry="4.5" fill="#f4f6f2"/>
  </g>`,
  // Stage 3 — Blooming Spring (life returning, wildflowers across meadows, floral haze)
  `<defs>
    <linearGradient id="s3sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#78c9ed"/><stop offset="55%" stop-color="#c9eee1"/><stop offset="100%" stop-color="#f0f6df"/></linearGradient>
    <linearGradient id="s3stream" x1="0" y1="0" x2=".3" y2="1"><stop offset="0%" stop-color="#a5e4df"/><stop offset="100%" stop-color="#559fbd"/></linearGradient>
    <linearGradient id="s3haze" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#f7edf2" stop-opacity=".48"/><stop offset="100%" stop-color="#e8f8ec" stop-opacity="0"/></linearGradient>
    <radialGradient id="s3sun" cx=".5" cy=".5" r=".5"><stop offset="0%" stop-color="#fffdf0" stop-opacity=".96"/><stop offset="35%" stop-color="#fff4b8" stop-opacity=".74"/><stop offset="100%" stop-color="#fff4b8" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="1440" height="900" fill="url(#s3sky)"/>
  <circle cx="1160" cy="145" r="86" fill="url(#s3sun)" class="env-sun-glow"/>
  <circle cx="1160" cy="145" r="31" fill="#fff9d8" opacity=".88"/>
  <g class="env-clouds" fill="#fff" opacity=".62"><path d="M70 155 Q115 118 165 140 Q215 110 270 150 Q290 175 250 184 H95Z"/><path d="M710 120 Q750 92 795 112 Q835 88 880 122 Q900 146 866 154 H728Z"/></g>
  <!-- Three organic alpine depth layers with softened ridges and distant forest. -->
  <path d="M0 438 Q90 382 172 408 Q250 350 340 406 Q430 337 520 400 Q610 350 705 412 Q790 354 885 410 Q985 338 1080 404 Q1180 348 1260 395 Q1355 352 1440 410 V560 H0Z" fill="#b5d2ca" opacity=".48"/>
  <path d="M0 505 L118 420 Q150 392 182 424 L278 478 L404 362 Q438 326 476 370 L618 455 L758 382 Q793 346 830 389 L972 462 L1140 367 Q1180 334 1215 376 L1325 425 L1440 388 V590 H0Z" fill="#78a79d" opacity=".68"/>
  <path d="M0 548 Q145 468 282 516 Q410 444 542 505 Q675 442 808 508 Q955 446 1088 510 Q1260 445 1440 500 V620 H0Z" fill="#618f7a" opacity=".62"/>
  <g fill="#eef6f3" opacity=".76"><path d="M404 362 Q440 326 476 370 L454 361 L440 382 L428 360Z"/><path d="M758 382 Q793 346 830 389 L808 378 L795 398 L782 376Z"/><path d="M1140 367 Q1180 334 1215 376 L1192 365 L1178 386 L1165 363Z"/></g>
  <g fill="#426f5e" opacity=".48"><path d="M74 525 l9 -25 9 25Z M98 521 l8 -22 8 22Z M245 505 l9 -25 9 25Z M270 510 l8 -22 8 22Z M580 493 l9 -25 9 25Z M606 500 l8 -22 8 22Z M900 490 l9 -25 9 25Z M927 498 l8 -22 8 22Z M1290 480 l9 -25 9 25Z M1320 488 l8 -22 8 22Z"/></g>
  <path d="M0 560 Q350 500 720 540 T1440 520 L1440 900 H0Z" fill="#83c36b"/>
  <rect y="520" width="1440" height="145" fill="url(#s3haze)" class="env-mist"/>
  <path d="M0 650 Q380 590 760 630 T1440 610 V900 H0Z" fill="#67b653"/>
  <path d="M0 738 Q380 690 780 720 T1440 700 V900 H0Z" fill="#4f9e3d"/>
  <!-- Clear spring stream curls around the board. -->
  <path class="env-stream" d="M95 900 Q245 790 430 710 T720 625 T930 540 L962 548 Q820 622 730 666 T450 742 T145 900Z" fill="url(#s3stream)"/>
  <path class="env-s2-waterline" d="M120 900 Q265 794 444 716 T730 634 T945 545" stroke="#e9ffff" stroke-width="3" fill="none" opacity=".65"/>
  <!-- Mid-distance life along the upper stream: groves, flowers and insects. -->
  <g opacity=".9">
    <g transform="translate(275 585)"><path d="M0 54 Q2 10 -3 -35" stroke="#72563f" stroke-width="9"/><g fill="#5da456"><circle cx="-25" cy="-40" r="27"/><circle cx="5" cy="-54" r="32"/><circle cx="35" cy="-38" r="25"/></g><g fill="#94cf72"><circle cx="-6" cy="-62" r="14"/><circle cx="29" cy="-45" r="12"/></g></g>
    <g transform="translate(1065 570) scale(.92)"><path d="M0 58 Q-1 12 5 -38" stroke="#765942" stroke-width="10"/><g fill="#52994e"><ellipse cx="-30" cy="-42" rx="29" ry="34"/><ellipse cx="4" cy="-59" rx="35" ry="40"/><ellipse cx="39" cy="-41" rx="29" ry="35"/></g><g fill="#88c96a"><ellipse cx="-8" cy="-70" rx="15" ry="19"/><ellipse cx="30" cy="-50" rx="14" ry="18"/></g></g>
    <g transform="translate(1210 590) scale(.72)"><path d="M0 55 V-32" stroke="#806047" stroke-width="9"/><g fill="#68a95d"><circle cx="-24" cy="-38" r="25"/><circle cx="4" cy="-52" r="29"/><circle cx="31" cy="-36" r="23"/></g></g>
  </g>
  <!-- Left midground grove fills the open bank without competing with the board. -->
  <g transform="translate(365 625) scale(.82)">
    <g class="env-fg-sway">
      <path d="M0 64 Q2 12 -2 -48 M0 -4 Q-28 -27 -43 -51 M1 -17 Q27 -38 43 -56" stroke="#765740" stroke-width="11" stroke-linecap="round" fill="none"/>
      <g fill="#5fa055"><circle cx="-42" cy="-53" r="28"/><circle cx="-13" cy="-72" r="34"/><circle cx="21" cy="-73" r="35"/><circle cx="48" cy="-51" r="27"/><circle cx="11" cy="-38" r="34"/></g>
      <g fill="#91c66f" opacity=".82"><circle cx="-19" cy="-82" r="15"/><circle cx="18" cy="-85" r="16"/><circle cx="43" cy="-57" r="13"/></g>
    </g>
    <!-- Small hive hangs where trunk meets the canopy. -->
    <g transform="translate(15 -37)"><path d="M0 -17 V-9" stroke="#624831" stroke-width="3"/><ellipse cy="0" rx="10" ry="14" fill="#d9a83b"/><path d="M-8 -6 H8 M-10 0 H10 M-8 6 H8" stroke="#9c7127" stroke-width="2"/><circle cx="3" cy="7" r="2.5" fill="#5b4026"/></g>
  </g>
  <g transform="translate(465 620) scale(.64)"><g class="env-fg-sway"><path d="M0 60 Q-1 10 3 -43" stroke="#795a43" stroke-width="11"/><g fill="#65a65a"><ellipse cx="-28" cy="-48" rx="29" ry="34"/><ellipse cx="5" cy="-65" rx="36" ry="41"/><ellipse cx="38" cy="-46" rx="28" ry="34"/></g><g fill="#9acb75" opacity=".78"><ellipse cx="-5" cy="-76" rx="15" ry="19"/><ellipse cx="31" cy="-53" rx="13" ry="17"/></g></g></g>
  <g transform="translate(430 641)"><g class="env-s2-grass slow"><g fill="#679956"><circle cx="-30" cy="4" r="20"/><circle cx="-7" cy="-3" r="25"/><circle cx="20" cy="3" r="22"/><circle cx="42" cy="8" r="17"/></g><g fill="#91bc70" opacity=".78"><circle cx="-10" cy="-13" r="10"/><circle cx="27" cy="-6" r="9"/></g></g></g>
  <g transform="translate(400 570)"><g class="env-bee env-insect-late"><ellipse rx="8" ry="5" fill="#efbd3e"/><path d="M-3 -5 V5 M3 -5 V5" stroke="#4b3b24" stroke-width="2"/><ellipse cx="-4" cy="-6" rx="5" ry="3" fill="#eaf8ff" opacity=".78"/></g></g>
  <!-- Shrub and brush layers make the upper banks feel inhabited and deep. -->
  <g opacity=".92">
    <g transform="translate(95 620)"><g class="env-s2-grass slow"><path d="M0 22 Q15 -18 30 20 M18 22 Q38 -30 52 18 M42 22 Q60 -16 75 20" stroke="#486f42" stroke-width="6" fill="none" stroke-linecap="round"/><g fill="#719f5c"><circle cx="8" cy="6" r="16"/><circle cx="31" cy="0" r="21"/><circle cx="57" cy="6" r="18"/><circle cx="75" cy="11" r="14"/></g></g></g>
    <g transform="translate(345 625)"><path d="M0 18 Q8 -18 20 12 M12 17 Q35 -28 47 14 M38 18 Q58 -16 70 15" stroke="#795b43" stroke-width="4" fill="none" stroke-linecap="round"/><g fill="#83ad68"><circle cx="12" cy="8" r="13"/><circle cx="34" cy="2" r="17"/><circle cx="57" cy="8" r="14"/></g><g fill="#f1e6c0"><circle cx="23" cy="-2" r="2.5"/><circle cx="45" cy="2" r="2.5"/></g></g>
    <g transform="translate(1000 610)"><g class="env-s2-grass"><path d="M0 25 Q18 -24 32 21 M22 24 Q45 -34 60 20 M50 25 Q70 -20 86 22" stroke="#4c7544" stroke-width="6" fill="none" stroke-linecap="round"/><g fill="#6fa65c"><circle cx="9" cy="10" r="17"/><circle cx="34" cy="1" r="23"/><circle cx="64" cy="7" r="20"/><circle cx="88" cy="13" r="15"/></g></g></g>
    <g transform="translate(1270 620)"><path d="M0 20 Q12 -20 25 15 M15 20 Q35 -27 48 16 M42 20 Q60 -13 73 18" stroke="#77583f" stroke-width="4" fill="none" stroke-linecap="round"/><g fill="#7aa761"><circle cx="10" cy="10" r="15"/><circle cx="34" cy="3" r="19"/><circle cx="58" cy="10" r="16"/></g></g>
  </g>
  <g opacity=".95">
    <g stroke="#397b47" stroke-width="3"><path d="M120 655 V630 M150 660 V626 M185 652 V624 M225 660 V632 M1005 640 V615 M1040 648 V618 M1090 642 V612 M1160 650 V620 M1220 646 V616"/></g>
    <g fill="#ef6f94"><circle cx="120" cy="627" r="6"/><circle cx="225" cy="629" r="6"/><circle cx="1040" cy="615" r="6"/><circle cx="1160" cy="617" r="6"/></g>
    <g fill="#f5d25d"><circle cx="150" cy="623" r="6"/><circle cx="1005" cy="612" r="6"/><circle cx="1220" cy="613" r="6"/></g>
    <g fill="#ad82df"><circle cx="185" cy="621" r="6"/><circle cx="1090" cy="609" r="6"/></g>
  </g>
  <g transform="translate(235 610)"><g class="env-butterfly"><path d="M0 0 Q-13 -12 -17 2 Q-10 11 0 4 Q10 11 17 2 Q13 -12 0 0Z" fill="#e984b7"/><circle r="2" fill="#62425d"/></g></g>
  <g transform="translate(1140 600)"><g class="env-butterfly env-insect-late"><path d="M0 0 Q-12 -11 -16 2 Q-9 10 0 4 Q9 10 16 2 Q12 -11 0 0Z" fill="#8f7bd9"/><circle r="2" fill="#4e4265"/></g></g>
  <g transform="translate(1030 625)"><g class="env-bee"><ellipse rx="8" ry="5" fill="#efbd3e"/><path d="M-3 -5 V5 M3 -5 V5" stroke="#4b3b24" stroke-width="2"/><ellipse cx="-4" cy="-6" rx="5" ry="3" fill="#eaf8ff" opacity=".75"/></g></g>
  <!-- Layered trees frame a calm central play area. -->
  <g transform="translate(130 675)"><g class="env-fg-sway"><path d="M0 105 Q2 25 -4 -75 M0 5 Q-48 -30 -75 -70 M0 -15 Q44 -48 73 -82" stroke="#6f4d35" stroke-width="17" fill="none" stroke-linecap="round"/><g fill="#4d9a48"><circle cx="-75" cy="-72" r="45"/><circle cx="-34" cy="-102" r="52"/><circle cx="18" cy="-110" r="56"/><circle cx="70" cy="-84" r="48"/><circle cx="24" cy="-58" r="53"/></g><g fill="#8fd16e" opacity=".8"><circle cx="-42" cy="-115" r="23"/><circle cx="12" cy="-128" r="26"/><circle cx="62" cy="-94" r="22"/></g></g></g>
  <g transform="translate(1280 690)"><g class="env-fg-sway"><path d="M0 105 Q-2 24 5 -75 M2 -5 Q-38 -35 -60 -73 M4 -20 Q43 -50 67 -80" stroke="#74513a" stroke-width="17" fill="none" stroke-linecap="round"/><g fill="#438e43"><ellipse cx="-57" cy="-75" rx="43" ry="49"/><ellipse cx="-18" cy="-107" rx="49" ry="57"/><ellipse cx="31" cy="-104" rx="50" ry="58"/><ellipse cx="66" cy="-72" rx="42" ry="48"/><ellipse cx="18" cy="-57" rx="55" ry="45"/></g><g fill="#83c963" opacity=".82"><ellipse cx="-25" cy="-125" rx="23" ry="27"/><ellipse cx="25" cy="-125" rx="24" ry="29"/><ellipse cx="61" cy="-84" rx="20" ry="24"/></g></g></g>
  <!-- A colorful tulip colony fills the left bank in the middle distance. -->
  <g transform="translate(185 675)"><g class="env-s2-grass">
    <g stroke="#397642" stroke-width="4" stroke-linecap="round"><path d="M0 38 V5 M28 42 V3 M58 38 V-2 M90 44 V8 M122 39 V0 M154 43 V6"/></g>
    <g><path d="M-10 5 Q0 -12 10 5 Q0 18 -10 5Z" fill="#f45f7d"/><path d="M18 3 Q28 -15 38 3 Q28 17 18 3Z" fill="#f6c64f"/><path d="M48 -2 Q58 -20 68 -2 Q58 13 48 -2Z" fill="#a96be0"/><path d="M80 8 Q90 -10 100 8 Q90 22 80 8Z" fill="#f185b2"/><path d="M112 0 Q122 -18 132 0 Q122 15 112 0Z" fill="#ee6a45"/><path d="M144 6 Q154 -12 164 6 Q154 21 144 6Z" fill="#f5d85f"/></g>
    <g fill="#5b9a52"><ellipse cx="-7" cy="24" rx="11" ry="4" transform="rotate(-30 -7 24)"/><ellipse cx="36" cy="25" rx="11" ry="4" transform="rotate(28 36 25)"/><ellipse cx="50" cy="19" rx="11" ry="4" transform="rotate(-28 50 19)"/><ellipse cx="100" cy="28" rx="11" ry="4" transform="rotate(30 100 28)"/><ellipse cx="132" cy="20" rx="11" ry="4" transform="rotate(-30 132 20)"/></g>
  </g></g>
  <!-- Turtle moved into the deeper left bank, walking toward the tulips. -->
  <g transform="translate(360 675) scale(.88)"><g class="env-turtle-walk"><ellipse cx="0" cy="0" rx="28" ry="17" fill="#547a3e"/><path d="M-23 0 Q0 -28 23 0 Q0 17 -23 0Z" fill="#78964b"/><path d="M-14 -5 L14 7 M14 -5 L-14 7 M0 -16 V12" stroke="#a8b96d" stroke-width="2" opacity=".8"/><circle cx="31" cy="1" r="9" fill="#6f9450"/><circle cx="34" cy="-1" r="1.8" fill="#172417"/><path d="M-17 11 l-9 8 M17 11 l9 8 M-18 -10 l-8 -7 M17 -10 l8 -7" stroke="#587a42" stroke-width="5" stroke-linecap="round"/></g></g>
  <!-- Ground-feeding birds: independent pecking rhythms. -->
  <g transform="translate(365 724) rotate(27) scale(1.25)"><g class="env-bird-peck"><path d="M-6 -1 Q-15 -8 -22 -5 L-12 5 Q-8 6 -5 3Z" fill="#526b84"/><ellipse rx="10" ry="7" fill="#7b95ad"/><circle cx="8" cy="-6" r="6" fill="#9bb1c4"/><circle cx="10" cy="-8" r="1.5" fill="#17212a"/><path d="M14 -6 l8 3 -8 3Z" fill="#d6a34d"/></g></g>
  <g transform="translate(220 763) scale(1.2)"><g class="env-bird-peck env-bird-late"><path d="M-5 -1 Q-14 -7 -20 -4 L-11 5 Q-7 6 -4 3Z" fill="#8d624c"/><ellipse rx="9" ry="6" fill="#b48765"/><circle cx="7" cy="-5" r="5" fill="#d3ab87"/><circle cx="9" cy="-7" r="1.4" fill="#241a16"/><path d="M12 -5 l7 3 -7 3Z" fill="#d6a34d"/></g></g>
  <g transform="translate(280 751) scale(-1.25 1.25)"><g class="env-bird-peck env-bird-later"><path d="M-6 -1 Q-15 -8 -22 -5 L-12 5 Q-8 6 -5 3Z" fill="#536c50"/><ellipse rx="10" ry="7" fill="#78906f"/><circle cx="8" cy="-6" r="6" fill="#a8b69b"/><circle cx="10" cy="-8" r="1.5" fill="#17221a"/><path d="M14 -6 l8 3 -8 3Z" fill="#d6a34d"/></g></g>
  <g transform="translate(250 773)" fill="#e7bd47"><circle cx="-18" cy="0" r="2.4"/><circle cx="-12" cy="-3" r="2"/><circle cx="-6" cy="0" r="2.6"/><circle cx="0" cy="-2" r="2"/><circle cx="7" cy="1" r="2.4"/><circle cx="-4" cy="-5" r="2"/></g>
  <!-- Low brush and a fallen log replace the former shepherd area. -->
  <g transform="translate(1080 720)">
    <path d="M-34 8 Q-4 -8 42 3" stroke="#68482f" stroke-width="19" stroke-linecap="round"/>
    <ellipse cx="43" cy="3" rx="10" ry="12" fill="#9a7048"/><ellipse cx="43" cy="3" rx="5" ry="7" fill="none" stroke="#6e4d34" stroke-width="2"/>
    <path d="M-26 -1 l-17 -18 M4 -4 l12 -20" stroke="#65462f" stroke-width="6" stroke-linecap="round"/>
    <g fill="#689b56"><circle cx="-48" cy="7" r="20"/><circle cx="-29" cy="-2" r="24"/><circle cx="2" cy="2" r="19"/><circle cx="66" cy="9" r="18"/><circle cx="83" cy="3" r="21"/></g>
    <g fill="#9cc278" opacity=".8"><circle cx="-35" cy="-12" r="10"/><circle cx="73" cy="-8" r="9"/></g>
  </g>
  <!-- A soft country footpath curls away from the stream into the foreground. -->
  <g transform="translate(60 0)">
  <path d="M690 700 Q760 730 785 770 Q815 815 900 900 L1060 900 Q925 820 900 770 Q875 722 770 684Z" fill="#c7ad78" opacity=".92"/>
  <path d="M706 699 Q780 733 806 773 Q842 826 942 900" stroke="#e1ca98" stroke-width="5" fill="none" opacity=".62" stroke-linecap="round"/>
  <g fill="#8d805f" opacity=".88">
    <ellipse cx="742" cy="718" rx="11" ry="6" transform="rotate(-18 742 718)"/><ellipse cx="825" cy="772" rx="14" ry="8" transform="rotate(14 825 772)"/>
    <ellipse cx="865" cy="830" rx="12" ry="7" transform="rotate(-12 865 830)"/><ellipse cx="975" cy="876" rx="16" ry="9" transform="rotate(10 975 876)"/>
  </g>
  <!-- Naturally scattered edge stones and one mossy path rock. -->
  <g>
    <g fill="#827b68"><ellipse cx="705" cy="717" rx="13" ry="8" transform="rotate(-16 705 717)"/><ellipse cx="754" cy="758" rx="10" ry="7"/><ellipse cx="802" cy="814" rx="15" ry="9" transform="rotate(12 802 814)"/><ellipse cx="858" cy="865" rx="12" ry="8"/></g>
    <g fill="#9a927b"><ellipse cx="787" cy="704" rx="10" ry="6"/><ellipse cx="873" cy="752" rx="13" ry="8" transform="rotate(-12 873 752)"/><ellipse cx="930" cy="805" rx="11" ry="7"/><ellipse cx="1015" cy="871" rx="14" ry="9" transform="rotate(15 1015 871)"/></g>
    <g transform="translate(940 785)">
      <path d="M-38 25 Q-34 -11 -10 -30 Q18 -34 39 -8 Q50 15 31 29 H-27Z" fill="#777865"/>
      <path d="M-28 10 Q-22 -12 -6 -23 Q11 -26 26 -10 Q10 -5 -2 8 Q-15 15 -28 10Z" fill="#999b83" opacity=".82"/>
      <path d="M-17 -13 Q-3 -25 14 -15 Q4 -5 -11 1Z" fill="#76945e" opacity=".78"/>
      <ellipse cx="3" cy="29" rx="43" ry="8" fill="#536742" opacity=".2"/>
    </g>
  </g>
  <g transform="translate(720 760)"><g class="env-s2-grass slow" stroke="#397947" stroke-width="4" stroke-linecap="round" fill="none"><path d="M0 28 Q7 5 13 -9 M14 28 Q22 2 32 -13 M34 28 Q41 8 49 -5 M172 58 Q179 32 187 18 M190 60 Q198 28 207 13 M211 62 Q218 38 228 24"/></g></g>
  <g transform="translate(760 744)">
    <g stroke="#4d874c" stroke-width="2.5"><path d="M0 16 V0 M22 18 V1 M46 17 V-2 M190 70 V51 M216 74 V53"/></g>
    <g fill="#fffdf0"><circle cx="0" cy="-2" r="5"/><circle cx="22" cy="-1" r="5"/><circle cx="46" cy="-4" r="5"/><circle cx="190" cy="49" r="5"/><circle cx="216" cy="51" r="5"/></g>
    <g fill="#f2c84c"><circle cx="0" cy="-2" r="2"/><circle cx="22" cy="-1" r="2"/><circle cx="46" cy="-4" r="2"/><circle cx="190" cy="49" r="2"/><circle cx="216" cy="51" r="2"/></g>
  </g>
  <g transform="translate(930 810)">
    <path d="M0 20 V5 M22 22 V8 M40 21 V2" stroke="#eee2c1" stroke-width="6" stroke-linecap="round"/>
    <path d="M-13 6 Q0 -11 13 6Z" fill="#cf6856"/><path d="M10 9 Q22 -6 34 9Z" fill="#e39a59"/><path d="M27 3 Q40 -14 53 3Z" fill="#bd5f50"/>
    <g fill="#f8e4c4"><circle cx="-3" cy="1" r="2"/><circle cx="7" cy="2" r="2"/><circle cx="18" cy="5" r="1.8"/><circle cx="37" cy="-1" r="2"/></g>
  </g>
  </g>
  <!-- Two perched birds beneath the tree canopies. -->
  <g transform="translate(190 570) scale(1.2)"><g class="env-bird-perch"><path d="M-6 -1 Q-16 -9 -23 -6 L-12 5 Q-8 6 -5 3Z" fill="#48637d"/><ellipse rx="10" ry="7" fill="#627e9b"/><circle cx="8" cy="-6" r="6" fill="#8fa6bd"/><circle cx="10" cy="-8" r="1.5" fill="#17212a"/><path d="M14 -6 l8 3 -8 3Z" fill="#d9a54b"/></g></g>
  <g transform="translate(1225 585) scale(1.2)"><ellipse cx="0" cy="5" rx="19" ry="8" fill="#6f4b31"/><path d="M-16 3 Q0 -9 16 3 M-14 7 Q0 -3 14 7" stroke="#a27a50" stroke-width="3" fill="none"/><g class="env-bird-perch env-bird-late"><path d="M-6 -1 Q-16 -8 -22 -5 L-12 5 Q-8 6 -5 3Z" fill="#7f5049"/><ellipse rx="10" ry="7" fill="#a76d61"/><circle cx="8" cy="-6" r="6" fill="#c99382"/><circle cx="10" cy="-8" r="1.5" fill="#281915"/><path d="M14 -6 l8 3 -8 3Z" fill="#d9a54b"/></g></g>`,

  // Stage 4 — lush spring Sakura Garden, bright blue sky, rolling alpine hills & falling petals
  `<defs>
    <linearGradient id="s4sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#3b9de3"/>
      <stop offset="45%" stop-color="#6ee2ec"/>
      <stop offset="100%" stop-color="#cbf4e2"/>
    </linearGradient>
    <radialGradient id="s4sun" cx="0.2" cy="0.18" r="0.45">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.95"/>
      <stop offset="35%" stop-color="#fff4b8" stop-opacity="0.6"/>
      <stop offset="100%" stop-color="#fff4b8" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="s4ray" x1="0" y1="0" x2="0.5" y2="1">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.28"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="s4river" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#76d0e8" stop-opacity="0.8"/>
      <stop offset="100%" stop-color="#a4f4e0" stop-opacity="0.95"/>
    </linearGradient>
    <linearGradient id="s4mist" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#d4f6e8" stop-opacity="0.6"/>
      <stop offset="100%" stop-color="#d4f6e8" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <!-- Sky & Sun -->
  <rect width="1440" height="900" fill="url(#s4sky)"/>
  <circle cx="280" cy="150" r="160" fill="url(#s4sun)"/>
  <g class="env-rays" opacity="0.85">
    <polygon points="280,150 -50,650 100,650" fill="url(#s4ray)"/>
    <polygon points="280,150 160,900 380,900" fill="url(#s4ray)"/>
    <polygon points="280,150 560,900 800,900" fill="url(#s4ray)"/>
  </g>
  <!-- Drifting White Clouds -->
  <g class="env-clouds" opacity="0.85" fill="#ffffff">
    <path d="M80 150 Q110 110 150 120 Q190 100 230 130 Q260 120 280 150 Q290 170 260 180 L100 180 Z"/>
    <path d="M740 120 Q765 90 800 100 Q835 80 870 105 Q895 95 915 120 Q925 140 900 150 L755 150 Z" opacity="0.75"/>
    <path d="M1140 170 Q1165 140 1200 150 Q1235 130 1270 155 Q1295 145 1315 170 Q1325 190 1300 200 L1155 200 Z" opacity="0.7"/>
  </g>
  <!-- Organic snow-dusted Alpine ranges: layered, irregular and atmospheric. -->
  <path d="M0 448 Q95 392 180 420 Q278 350 365 412 Q455 332 552 406 Q650 354 742 418 Q842 344 935 410 Q1038 350 1128 414 Q1230 338 1320 402 Q1384 370 1440 406 V560 H0Z" fill="#75aaa4" opacity=".32"/>
  <path d="M0 512 L118 432 Q148 398 181 428 L286 480 L420 372 Q452 338 487 376 L632 462 L786 388 Q820 352 856 394 L1010 466 L1170 382 Q1205 345 1242 389 L1340 438 L1440 397 V606 H0Z" fill="#3c867c" opacity=".55"/>
  <path d="M0 558 Q150 480 300 524 Q438 455 585 516 Q725 455 865 520 Q1015 460 1165 518 Q1305 458 1440 506 V635 H0Z" fill="#2e746a" opacity=".58"/>
  <g fill="#edf7f5" opacity=".72"><path d="M420 372 Q452 338 487 376 L467 368 L452 391 L438 367Z"/><path d="M786 388 Q820 352 856 394 L836 383 L820 406 L806 382Z"/><path d="M1170 382 Q1205 345 1242 389 L1220 378 L1205 401 L1190 377Z"/></g>
  <g fill="#235f58" opacity=".36"><path d="M88 530 l9 -25 9 25Z M115 526 l8 -22 8 22Z M335 505 l9 -25 9 25Z M365 510 l8 -22 8 22Z M690 505 l9 -25 9 25Z M718 512 l8 -22 8 22Z M1065 500 l9 -25 9 25Z M1095 506 l8 -22 8 22Z M1360 486 l9 -25 9 25Z"/></g>
  <!-- Valley Floor & Winding River -->
  <path d="M0 600 Q360 540 720 580 T1440 570 L1440 900 L0 900Z" fill="#69b848"/>
  <path d="M720 580 Q660 620 685 670 T750 730 T670 810 T720 900 L785 900 Q720 810 L790 730 Q725 670 750 580 Z" fill="url(#s4river)"/>
  <!-- Valley Mist Layer -->
  <rect x="0" y="560" width="1440" height="120" fill="url(#s4mist)" class="env-mist"/>
  <!-- Midground Rolling Hills -->
  <path d="M0 660 Q420 615 780 645 T1440 635 L1440 900 L0 900Z" fill="#52a035"/>
  <path d="M0 730 Q380 690 760 715 T1440 705 L1440 900 L0 900Z" fill="#3f8826"/>
  <!-- Midground Sakura Groves (Slope Accents) -->
  <g transform="translate(1140, 590)">
    <path d="M0 35 Q-4 15 0 0" stroke="#3d261a" stroke-width="5" fill="none"/>
    <path d="M0 -15 Q-25 -25 -38 0 Q-15 25 0 15 Z" fill="#e77f9d"/>
    <path d="M0 -15 Q25 -25 38 0 Q15 25 0 15 Z" fill="#f78fb3"/>
    <circle cx="0" cy="-18" r="28" fill="#f8a5c2"/>
  </g>
  <!-- Foreground High Cliff Bluff (Bottom Right) -->
  <path d="M920 900 Q1040 690 1440 670 L1440 900 Z" fill="#2d6e1b"/>
  <path d="M960 900 Q1070 715 1440 700 L1440 900 Z" fill="#225414"/>
  <!-- Static Petal Drifts on Bluff Edge -->
  <path d="M1060 745 Q1200 710 1380 730 Q1240 760 1060 745 Z" fill="#f8a5c2" opacity="0.85"/>
  <path d="M1120 760 Q1240 735 1350 750 Q1240 775 1120 760 Z" fill="#f78fb3" opacity="0.8"/>
  <!-- Detailed Wildflowers & Grass Tufts -->
  <g fill="#f78fb3">
    <circle cx="1020" cy="760" r="3.5"/><circle cx="1035" cy="755" r="4"/><circle cx="1050" cy="762" r="3"/>
    <circle cx="1240" cy="735" r="3.5"/><circle cx="1255" cy="730" r="4"/><circle cx="1270" cy="738" r="3"/>
  </g>
  <g fill="#f6d743">
    <circle cx="1080" cy="770" r="3"/><circle cx="1095" cy="765" r="3.5"/><circle cx="1290" cy="745" r="3"/>
  </g>
  <g fill="#ffffff">
    <circle cx="1140" cy="778" r="2.5"/><circle cx="1155" cy="772" r="3"/><circle cx="1330" cy="752" r="2.5"/>
  </g>
  <!-- Stage 4-specific flowers: lupines, irises and alpine flowering shrubs. -->
  <g transform="translate(105 735)"><g class="env-s2-grass slow">
    <g stroke="#327246" stroke-width="4" stroke-linecap="round"><path d="M0 68 V5 M34 72 V0 M70 66 V8 M105 74 V-2 M142 68 V6"/></g>
    <g><path d="M-10 24 Q0 -12 10 24Z" fill="#8f68d9"/><path d="M24 20 Q34 -18 44 20Z" fill="#ba75df"/><path d="M60 27 Q70 -8 80 27Z" fill="#695fd0"/><path d="M95 19 Q105 -22 115 19Z" fill="#d58acb"/><path d="M132 25 Q142 -10 152 25Z" fill="#7b73df"/></g>
    <g fill="#f0d2f0" opacity=".8"><circle cx="0" cy="4" r="3"/><circle cx="34" cy="0" r="3"/><circle cx="70" cy="8" r="3"/><circle cx="105" cy="-2" r="3"/><circle cx="142" cy="6" r="3"/></g>
  </g></g>
  <g transform="translate(275 790)"><g class="env-s2-grass">
    <g stroke="#39784c" stroke-width="4"><path d="M0 48 V10 M38 52 V13 M75 48 V8"/></g>
    <g fill="#6676df"><path d="M-18 12 Q0 -8 18 12 Q5 17 0 32 Q-5 17 -18 12Z"/><path d="M20 15 Q38 -5 56 15 Q43 20 38 35 Q33 20 20 15Z"/><path d="M57 10 Q75 -10 93 10 Q80 15 75 30 Q70 15 57 10Z"/></g>
    <g fill="#f2c94e"><circle cx="0" cy="13" r="4"/><circle cx="38" cy="16" r="4"/><circle cx="75" cy="11" r="4"/></g>
  </g></g>
  <g transform="translate(1020 790)">
    <g fill="#b84f86"><circle cx="0" cy="8" r="24"/><circle cx="28" cy="0" r="29"/><circle cx="62" cy="8" r="25"/><circle cx="88" cy="14" r="20"/></g>
    <g fill="#f28eb4"><circle cx="9" cy="0" r="8"/><circle cx="31" cy="-10" r="9"/><circle cx="55" cy="1" r="8"/><circle cx="80" cy="7" r="7"/></g>
    <g fill="#f8d7e5"><circle cx="6" cy="-2" r="3"/><circle cx="31" cy="-12" r="3"/><circle cx="55" cy="-1" r="3"/><circle cx="80" cy="5" r="3"/></g>
  </g>
  <g transform="translate(1280 805) scale(.9)">
    <g fill="#a9477e"><circle cx="0" cy="8" r="23"/><circle cx="27" cy="0" r="28"/><circle cx="58" cy="9" r="24"/></g>
    <g fill="#ed82ac"><circle cx="7" cy="1" r="8"/><circle cx="29" cy="-9" r="9"/><circle cx="53" cy="2" r="8"/></g>
  </g>
  <!-- Intricate Organic Sakura Framing Branch (Top Left) -->
  <g class="env-fg-sway" transform="translate(0, 0)">
    <!-- Detailed Branching Splines -->
    <path d="M-30 -10 Q140 30 310 135 Q380 180 440 225" stroke="#331e13" stroke-width="16" stroke-linecap="round" fill="none"/>
    <path d="M150 42 Q240 95 300 165" stroke="#331e13" stroke-width="9" stroke-linecap="round" fill="none"/>
    <path d="M280 120 Q350 135 410 168" stroke="#331e13" stroke-width="7" stroke-linecap="round" fill="none"/>
    <path d="M80 18 Q140 60 190 95" stroke="#331e13" stroke-width="6" stroke-linecap="round" fill="none"/>
    <!-- Organic Layered Blossom Masses -->
    <path d="M110 15 Q170 -25 240 15 Q280 60 210 90 Q140 95 110 50 Z" fill="#d96b8a"/>
    <path d="M130 25 Q180 -10 230 25 Q260 60 200 80 Q150 80 130 50 Z" fill="#e77f9d"/>
    <path d="M150 30 Q190 5 220 30 Q240 60 190 70 Q160 70 150 50 Z" fill="#f78fb3"/>
    <!-- Mid Cluster -->
    <path d="M210 90 Q280 50 350 95 Q390 145 320 175 Q250 180 210 130 Z" fill="#d96b8a"/>
    <path d="M230 100 Q290 65 340 105 Q370 145 310 165 Q260 165 230 135 Z" fill="#e77f9d"/>
    <path d="M250 110 Q300 80 330 115 Q350 145 300 155 Q270 155 250 135 Z" fill="#f8a5c2"/>
    <!-- Outer Tip Cluster -->
    <path d="M320 150 Q380 120 430 160 Q460 205 400 230 Q340 235 320 190 Z" fill="#e77f9d"/>
    <path d="M340 160 Q395 135 435 170 Q455 205 405 220 Q360 220 340 195 Z" fill="#f78fb3"/>
    <path d="M360 170 Q405 150 430 178 Q445 205 405 212 Q375 210 360 195 Z" fill="#fce4ec"/>
    <!-- Delicate Petal Highlights -->
    <circle cx="180" cy="35" r="16" fill="#ffffff" opacity="0.65"/>
    <circle cx="280" cy="115" r="18" fill="#ffffff" opacity="0.65"/>
    <circle cx="385" cy="180" r="15" fill="#ffffff" opacity="0.7"/>
  </g>`,

  // Stage 5 — Night of the completed world: Stage 4 valley after dusk.
  // Same sakura, river, meadows — now moonlit, framed by great trees, fireflies.
  `<defs>
    <linearGradient id="s5sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0c1028"/>
      <stop offset="38%" stop-color="#1a1650"/>
      <stop offset="72%" stop-color="#2a2468"/>
      <stop offset="100%" stop-color="#3a2a5a"/>
    </linearGradient>
    <radialGradient id="s5moon" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0%" stop-color="#f7f3e4" stop-opacity="1"/>
      <stop offset="38%" stop-color="#e8e4d4" stop-opacity="0.95"/>
      <stop offset="70%" stop-color="#c8d4f0" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="#c8d4f0" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="s5river" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#4a6a98" stop-opacity="0.75"/>
      <stop offset="100%" stop-color="#1c2848" stop-opacity="0.92"/>
    </linearGradient>
    <linearGradient id="s5mist" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#2a2468" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#2a2468" stop-opacity="0"/>
    </linearGradient>
    <radialGradient id="s5glow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0%" stop-color="#ffe9a0" stop-opacity="0.9"/>
      <stop offset="100%" stop-color="#ffe9a0" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="s5aurora" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#65e0c2" stop-opacity="0"/>
      <stop offset="45%" stop-color="#65e0c2" stop-opacity=".28"/>
      <stop offset="75%" stop-color="#c685e8" stop-opacity=".2"/>
      <stop offset="100%" stop-color="#c685e8" stop-opacity="0"/>
    </linearGradient>
  </defs>

  <rect width="1440" height="900" fill="url(#s5sky)"/>
  <g class="env-rays" opacity=".8">
    <path d="M140 -40 Q430 170 760 40 T1340 80 Q1050 170 740 120 T140 -40Z" fill="url(#s5aurora)"/>
    <path d="M-80 90 Q360 245 720 105 T1510 120 Q1110 260 700 190 T-80 90Z" fill="url(#s5aurora)" opacity=".55"/>
  </g>
  <g fill="#eef2ff">
    <circle cx="180" cy="70" r="1.2" opacity="0.7"/>
    <circle cx="260" cy="120" r="1.6" opacity="0.9"/>
    <circle cx="420" cy="55" r="1.1" opacity="0.55"/>
    <circle cx="510" cy="95" r="1.4" opacity="0.8"/>
    <circle cx="640" cy="40" r="1.2" opacity="0.65"/>
    <circle cx="780" cy="88" r="1.8" opacity="0.95"/>
    <circle cx="900" cy="50" r="1.1" opacity="0.5"/>
    <circle cx="1040" cy="110" r="1.3" opacity="0.75"/>
    <circle cx="1280" cy="62" r="1.5" opacity="0.85"/>
    <circle cx="1360" cy="130" r="1.1" opacity="0.6"/>
    <circle cx="90" cy="150" r="1" opacity="0.45"/>
    <circle cx="330" cy="180" r="1.2" opacity="0.55"/>
  </g>
  <circle cx="1180" cy="128" r="92" fill="url(#s5moon)" class="env-sun-glow"/>
  <circle cx="1180" cy="128" r="42" fill="#f4f0e0"/>
  <circle cx="1192" cy="118" r="7" fill="#d8d4c8" opacity="0.35"/>

  <path d="M0 500 L140 380 L280 450 L440 350 L620 440 L820 370 L1020 450 L1220 370 L1440 440 L1440 620 L0 620Z" fill="#1a2848" opacity="0.75"/>
  <path d="M0 540 L180 440 L340 490 L500 400 L700 480 L900 410 L1100 480 L1300 420 L1440 470 L1440 640 L0 640Z" fill="#152038" opacity="0.85"/>
  <path d="M440 350 L468 392 L412 392 Z" fill="#dce6f4" opacity="0.28"/>
  <path d="M820 370 L852 418 L788 418 Z" fill="#dce6f4" opacity="0.22"/>

  <path d="M0 600 Q360 540 720 580 T1440 570 L1440 900 L0 900Z" fill="#1c3a28"/>
  <path class="env-stream" d="M720 580 Q660 620 685 670 T750 730 T670 810 T720 900 L785 900 Q720 810 L790 730 Q725 670 750 580 Z" fill="url(#s5river)"/>
  <path d="M728 590 Q678 628 700 676 T762 734 T688 812" stroke="#c8d8f8" stroke-width="1.6" fill="none" opacity="0.28"/>
  <path d="M1172 172 Q1050 350 760 585 Q730 650 752 730 T700 900" stroke="#dbe8ff" stroke-width="14" fill="none" opacity=".08"/>
  <rect x="0" y="540" width="1440" height="130" fill="url(#s5mist)" class="env-mist"/>

  <path d="M0 660 Q420 615 780 645 T1440 635 L1440 900 L0 900Z" fill="#163224"/>
  <path d="M0 730 Q380 690 760 715 T1440 705 L1440 900 L0 900Z" fill="#12281c"/>

  <g transform="translate(1140, 590)">
    <path d="M0 35 Q-4 15 0 0" stroke="#1a100c" stroke-width="5" fill="none"/>
    <path d="M0 -15 Q-25 -25 -38 0 Q-15 25 0 15 Z" fill="#8a3d5c"/>
    <path d="M0 -15 Q25 -25 38 0 Q15 25 0 15 Z" fill="#b85a7a"/>
    <circle cx="0" cy="-18" r="28" fill="#c46a88"/>
    <circle cx="-8" cy="-22" r="8" fill="#f0c4d4" opacity="0.35"/>
  </g>

  <path d="M920 900 Q1040 690 1440 670 L1440 900 Z" fill="#0e2418"/>
  <path d="M960 900 Q1070 715 1440 700 L1440 900 Z" fill="#0a1c12"/>
  <path d="M1060 745 Q1200 710 1380 730 Q1240 760 1060 745 Z" fill="#8a3d5c" opacity="0.55"/>
  <path d="M1120 760 Q1240 735 1350 750 Q1240 775 1120 760 Z" fill="#b85a7a" opacity="0.5"/>

  <g fill="#e8a0b8" opacity="0.85">
    <circle cx="1020" cy="760" r="3.5"/><circle cx="1035" cy="755" r="4"/><circle cx="1050" cy="762" r="3"/>
    <circle cx="1240" cy="735" r="3.5"/><circle cx="1255" cy="730" r="4"/>
  </g>
  <g fill="#ffe08a" opacity="0.8">
    <circle cx="1080" cy="770" r="3"/><circle cx="1095" cy="765" r="3.5"/><circle cx="1290" cy="745" r="3"/>
  </g>
  <g fill="#fff4c8" opacity="0.7">
    <circle cx="1140" cy="778" r="2.5"/><circle cx="1155" cy="772" r="3"/>
  </g>
  <circle cx="1035" cy="755" r="10" fill="url(#s5glow)"/>
  <circle cx="1255" cy="730" r="10" fill="url(#s5glow)"/>
  <circle cx="1095" cy="765" r="8" fill="url(#s5glow)"/>

  <!-- Golden lantern path: a celebratory destination beyond the board. -->
  <g fill="#ffd878" stroke="#7a4c24" stroke-width="3">
    <rect x="500" y="675" width="20" height="30" rx="5"/><rect x="900" y="670" width="20" height="30" rx="5"/>
    <rect x="390" y="760" width="24" height="36" rx="6"/><rect x="1010" y="760" width="24" height="36" rx="6"/>
  </g>
  <g stroke="#432b1d" stroke-width="5"><path d="M510 705 V742"/><path d="M910 700 V737"/><path d="M402 796 V840"/><path d="M1022 796 V840"/></g>
  <g fill="url(#s5glow)"><circle cx="510" cy="690" r="30"/><circle cx="910" cy="685" r="30"/><circle cx="402" cy="778" r="38"/><circle cx="1022" cy="778" r="38"/></g>

  <!-- A mature moonlit branch, distinct from Stage 4's blossom-heavy Sakura canopy. -->
  <g class="env-fg-sway" transform="translate(-18, -8)">
    <g fill="none" stroke-linecap="round">
      <path d="M-35 4 Q92 16 190 68 Q286 118 410 205 Q455 238 492 278" stroke="#0c0909" stroke-width="20"/>
      <path d="M112 34 Q178 52 249 26 Q291 10 335 24" stroke="#130d0d" stroke-width="10"/>
      <path d="M192 70 Q242 106 274 163 Q294 199 334 224" stroke="#130d0d" stroke-width="9"/>
      <path d="M291 126 Q358 123 420 86" stroke="#130d0d" stroke-width="8"/>
      <path d="M372 179 Q428 185 474 161" stroke="#130d0d" stroke-width="6"/>
      <path d="M54 17 Q102 54 121 104" stroke="#130d0d" stroke-width="7"/>
    </g>
    <g fill="#274d45">
      <ellipse cx="56" cy="31" rx="30" ry="15" transform="rotate(28 56 31)"/><ellipse cx="91" cy="52" rx="29" ry="14" transform="rotate(-20 91 52)"/>
      <ellipse cx="116" cy="81" rx="31" ry="15" transform="rotate(48 116 81)"/><ellipse cx="146" cy="42" rx="34" ry="16" transform="rotate(-22 146 42)"/>
      <ellipse cx="181" cy="24" rx="31" ry="15" transform="rotate(-10 181 24)"/><ellipse cx="218" cy="34" rx="34" ry="16" transform="rotate(18 218 34)"/>
      <ellipse cx="256" cy="22" rx="31" ry="14" transform="rotate(-18 256 22)"/><ellipse cx="301" cy="30" rx="35" ry="16" transform="rotate(20 301 30)"/>
      <ellipse cx="171" cy="73" rx="34" ry="17" transform="rotate(24 171 73)"/><ellipse cx="216" cy="94" rx="35" ry="17" transform="rotate(-16 216 94)"/>
      <ellipse cx="249" cy="126" rx="32" ry="15" transform="rotate(43 249 126)"/><ellipse cx="273" cy="165" rx="31" ry="14" transform="rotate(58 273 165)"/>
      <ellipse cx="309" cy="130" rx="34" ry="16" transform="rotate(-12 309 130)"/><ellipse cx="351" cy="119" rx="33" ry="15" transform="rotate(12 351 119)"/>
      <ellipse cx="393" cy="96" rx="31" ry="14" transform="rotate(-27 393 96)"/><ellipse cx="329" cy="180" rx="35" ry="17" transform="rotate(29 329 180)"/>
      <ellipse cx="368" cy="203" rx="34" ry="16" transform="rotate(-13 368 203)"/><ellipse cx="409" cy="190" rx="32" ry="15" transform="rotate(20 409 190)"/>
      <ellipse cx="446" cy="170" rx="30" ry="14" transform="rotate(-18 446 170)"/><ellipse cx="414" cy="229" rx="34" ry="16" transform="rotate(31 414 229)"/>
      <ellipse cx="451" cy="251" rx="31" ry="15" transform="rotate(-9 451 251)"/><ellipse cx="482" cy="278" rx="28" ry="13" transform="rotate(38 482 278)"/>
    </g>
    <g fill="#3d7161">
      <ellipse cx="77" cy="20" rx="22" ry="10" transform="rotate(-16 77 20)"/><ellipse cx="132" cy="62" rx="23" ry="11" transform="rotate(32 132 62)"/>
      <ellipse cx="199" cy="52" rx="24" ry="11" transform="rotate(-12 199 52)"/><ellipse cx="273" cy="45" rx="22" ry="10" transform="rotate(25 273 45)"/>
      <ellipse cx="233" cy="112" rx="23" ry="11" transform="rotate(30 233 112)"/><ellipse cx="291" cy="145" rx="21" ry="10" transform="rotate(-21 291 145)"/>
      <ellipse cx="343" cy="102" rx="23" ry="10" transform="rotate(-18 343 102)"/><ellipse cx="388" cy="173" rx="23" ry="11" transform="rotate(25 388 173)"/>
      <ellipse cx="432" cy="208" rx="21" ry="10" transform="rotate(-12 432 208)"/><ellipse cx="468" cy="258" rx="20" ry="9" transform="rotate(30 468 258)"/>
    </g>
    <g fill="#72a58b" opacity=".72">
      <ellipse cx="84" cy="15" rx="12" ry="5" transform="rotate(-16 84 15)"/><ellipse cx="205" cy="47" rx="13" ry="5" transform="rotate(-12 205 47)"/>
      <ellipse cx="347" cy="96" rx="12" ry="5" transform="rotate(-18 347 96)"/><ellipse cx="392" cy="167" rx="12" ry="5" transform="rotate(25 392 167)"/>
      <ellipse cx="472" cy="253" rx="11" ry="4" transform="rotate(30 472 253)"/>
    </g>
    <g fill="#d999b6">
      <circle cx="158" cy="59" r="6"/><circle cx="166" cy="64" r="5"/><circle cx="321" cy="108" r="6"/><circle cx="329" cy="112" r="5"/>
      <circle cx="422" cy="180" r="5.5"/><circle cx="429" cy="184" r="4.5"/>
    </g>
    <g fill="#f6d5df" opacity=".9"><circle cx="160" cy="60" r="2"/><circle cx="323" cy="109" r="2"/><circle cx="424" cy="181" r="2"/></g>
  </g>

  <!-- Framing trees left and right so the board sits in a completed grove -->
  <g transform="translate(70, 720) scale(1.15)">
    <path d="M0 160 Q-12 40 -22 -80 Q-28 -150 -48 -220" stroke="#0c0806" stroke-width="22" stroke-linecap="round" fill="none"/>
    <path d="M-16 20 Q30 -50 70 -120" stroke="#0c0806" stroke-width="10" fill="none"/>
    <ellipse cx="-40" cy="-200" rx="70" ry="55" fill="#0e2418"/>
    <ellipse cx="10" cy="-170" rx="58" ry="46" fill="#163224"/>
    <ellipse cx="50" cy="-130" rx="40" ry="32" fill="#1c3a28"/>
    <circle cx="-20" cy="-210" r="18" fill="#2a5040" opacity="0.7"/>
  </g>
  <g transform="translate(1360, 700) scale(1.2)">
    <path d="M0 160 Q8 40 16 -70 Q22 -140 36 -200" stroke="#0c0806" stroke-width="20" stroke-linecap="round" fill="none"/>
    <path d="M10 10 Q-30 -40 -70 -100" stroke="#0c0806" stroke-width="9" fill="none"/>
    <ellipse cx="40" cy="-180" rx="68" ry="52" fill="#0e2418"/>
    <ellipse cx="-10" cy="-150" rx="54" ry="42" fill="#163224"/>
    <ellipse cx="-50" cy="-110" rx="36" ry="28" fill="#1c3a28"/>
    <circle cx="28" cy="-188" r="16" fill="#2a5040" opacity="0.65"/>
  </g>

  <path d="M30 860 Q55 810 80 860 M50 860 Q70 800 95 860 M100 870 Q125 820 150 870" stroke="#1a3c2c" stroke-width="6" stroke-linecap="round" fill="none"/>
  <path d="M1230 850 Q1255 800 1280 850 M1250 850 Q1270 790 1295 850 M1300 860 Q1325 810 1350 860" stroke="#1a3c2c" stroke-width="6" stroke-linecap="round" fill="none"/>

  <g fill="#ffe9a0" opacity="0.85">
    <circle cx="480" cy="640" r="2.2"/>
    <circle cx="620" cy="700" r="1.8"/>
    <circle cx="860" cy="660" r="2"/>
    <circle cx="980" cy="720" r="1.6"/>
    <circle cx="540" cy="760" r="1.7"/>
  </g>
  <circle cx="480" cy="640" r="9" fill="url(#s5glow)"/>
  <circle cx="860" cy="660" r="8" fill="url(#s5glow)"/>`
];

// Floating particle config per stage
export const STAGE_PARTICLES = [
  { type: "snow", count: 8 },     // stage1 winter snow
  { type: "leaf", count: 5 },     // stage2 fresh green leaves
  { type: "pollen", count: 7 },   // stage3 pale blossom haze
  { type: "petal", count: 10 },   // stage4 lush alpine sakura petals
  { type: "firefly", count: 11 }  // stage5 luminous fireflies
];


// env: the #env element, sky: where the SVG goes, particles: where the drifting
// bits go. canAnimate() says whether particles may move right now (the player
// has not turned them or motion off).
export function createFallbackScenery({ env, sky, particles, canAnimate }) {
  const phaserDraws = () => env.hasAttribute("data-phaser-active");

  function renderStage(stage) {
    if (phaserDraws()) {
      sky.replaceChildren();
      return;
    }
    sky.innerHTML = STAGE_SVG[stage - 1];
  }

  function clearParticles() {
    particles.innerHTML = "";
  }

  function spawnParticles(stage) {
    if (phaserDraws()) {
      clearParticles();
      return;
    }
    if (!canAnimate()) return;
    clearParticles();
    const cfg = STAGE_PARTICLES[stage - 1];
    const count = document.body.classList.contains("perf-low") ? Math.min(7, cfg.count) : cfg.count;
    for (let i = 0; i < count; i++) {
      const el = document.createElement("span");
      el.className = "env-particle " + cfg.type;
      if (cfg.type === "snow" && i % 3 === 0) {
        el.classList.add("fg");
      }
      el.style.left = Math.random() * 100 + "%";
      el.style.top = (10 + Math.random() * 70) + "%";
      el.style.animationDelay = -Math.random() * 18 + "s";
      el.style.animationDuration = (cfg.type === "snow" && i % 3 === 0 ? 8 + Math.random() * 5 : 14 + Math.random() * 10) + "s";
      if (cfg.type === "firefly" || cfg.type === "pollen") {
        el.style.setProperty("--fx", (Math.random() * 60 - 30) + "px");
        el.style.setProperty("--fy", (Math.random() * 40 - 20) + "px");
      }
      particles.appendChild(el);
    }
  }

  return { renderStage, clearParticles, spawnParticles };
}
