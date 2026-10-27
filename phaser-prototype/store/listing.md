# Store listings: Garden Evolution

Everything the Google Play Console and App Store Connect ask for, ready to
paste. Pictures are in this folder (see the end).

- **Package / bundle id:** `com.gardenevolution.game` (cannot change once published)
- **Category:** Games › Puzzle
- **Price:** Free, no in-app purchases, no ads
- **Privacy policy URL:** https://play.gardenevolution.workers.dev/privacy
- **Support / marketing URL:** https://play.gardenevolution.workers.dev
- **Contact email:** gardenevolutiongame@gmail.com

## Texts

### English

**Name (30):** Garden Evolution

**App Store subtitle (30):** Merge plants, grow worlds

**Play short description (80):** A calm merge puzzle: grow a seed into a celestial tree across five worlds.

**App Store promotional text (170):** Today's Garden is here: one shared puzzle a day, one ranked try, and a streak to keep. Plus 18 achievements to unlock.

**Full description:**

Slide, merge and watch your garden grow.

Garden Evolution is a relaxing merge puzzle. Swipe to bring matching plants together: two seeds become a sprout, two sprouts a young plant, and on it goes, all the way from a seed to the Celestial Tree.

As your plants grow, the world around them changes. Start in a quiet winter and let it melt into a snowmelt valley, a spring in full bloom, alpine sakura and finally a moonlit garden. There are five hand-painted pixel-art worlds, each with its own music and weather.

• Today's Garden: everyone gets the same puzzle each day. One ranked try, then practise as much as you like. Keep your daily streak going.
• Leaderboards for all time, this week, the last 24 hours and today's garden. Every score is checked by replaying the game, so the tables are fair.
• 18 achievements and your own stats.
• Bloom streaks: chain merges for a combo and a little piano melody.
• Look around your garden in the garden view, and share a picture of a finished run.
• Plays offline (ranked games need a connection), in portrait or landscape.
• 10 languages. No ads, no accounts, no in-app purchases.

**App Store keywords (100):** merge,puzzle,garden,plants,relaxing,cozy,pixel,daily,tree,number,zen,calm,grow

### Türkçe

**Ad (30):** Garden Evolution

**App Store alt başlık (30):** Bitki birleştir, bahçe büyüt

**Play kısa açıklama (80):** Sakin bir birleştirme bulmacası: tohumu beş dünyada göksel bir ağaca büyüt.

**App Store tanıtım metni (170):** Günün Bahçesi geldi: her gün herkese aynı bulmaca, tek sıralı deneme ve korunacak bir seri. Üstelik açılacak 18 başarım.

**Tam açıklama:**

Kaydır, birleştir ve bahçenin büyüyüşünü izle.

Garden Evolution rahatlatıcı bir birleştirme bulmacası. Aynı bitkileri bir araya getirmek için kaydır: iki tohum filiz olur, iki filiz genç bitki, ve böyle devam eder; tohumdan Göksel Ağaç'a kadar.

Bitkilerin büyüdükçe etrafındaki dünya da değişir. Sessiz bir kışla başla; kar eriyen bir vadiye, çiçek açan bir ilkbahara, Alp sakuralarına ve sonunda ay ışıklı bir bahçeye dönüşsün. Her birinin kendi müziği ve havası olan beş el çizimi piksel sanat dünya seni bekliyor.

• Günün Bahçesi: her gün herkes aynı bulmacayı oynar. Tek sıralı deneme, sonra dilediğin kadar pratik. Günlük serini bozma.
• Tüm zamanlar, bu hafta, son 24 saat ve günün bahçesi sıralamaları. Her skor oyun yeniden oynatılarak doğrulanır; tablolar adil.
• 18 başarım ve kendi istatistiklerin.
• Birleşme serileri: art arda birleştir, kombo yap ve küçük bir piyano melodisi dinle.
• Bahçe görünümünde etrafa bak, biten oyunun resmini paylaş.
• İnternetsiz oynanır (sıralı oyunlar bağlantı ister), dikey ya da yatay.
• 10 dil. Reklam yok, hesap yok, uygulama içi satın alma yok.

**App Store anahtar kelimeler (100):** birleştirme,bulmaca,bahçe,bitki,rahatlatıcı,piksel,günlük,ağaç,sayı,sakin,zen

## Content rating

- **Google (IARC questionnaire):** no violence, no fear, no sexual content, no gambling, no bad language, no drugs. Users can see each other's chosen leaderboard names (names are filtered; there is no chat). Expected rating: Everyone / PEGI 3 / USK 0.
- **Apple (age rating):** "None" for every content question; "Unrestricted web access": No; "User-generated content": the only user content is a filtered leaderboard name. Expected: 4+.

## Google Play: Data safety

| Data type | Collected | Shared | Optional | Purpose |
| --- | --- | --- | --- | --- |
| Personal info › Name (a nickname the player types for the leaderboard) | Yes | No | Yes (only when submitting a score) | App functionality |
| App activity › Other actions (scores and the record of moves of a submitted game) | Yes | No | Yes | App functionality, Fraud prevention |
| Device or other IDs (a random ID made by the app, not the device's advertising ID) | Yes | No | Yes | App functionality, Fraud prevention |
| App info and performance › Crash logs, Diagnostics (error reports) | Yes | No | No | Analytics (fixing bugs) |

- Data is encrypted in transit: **Yes** (HTTPS only).
- Users can request deletion: **Yes**, by email (see the privacy policy). No accounts.
- No ads, no advertising ID, no location, no contacts, no photos (sharing goes through the system share sheet).

## App Store: App Privacy

- **Data used to track you:** None.
- **Data linked to you:** None (there are no accounts; nothing is tied to an identity).
- **Data not linked to you:**
  - Identifiers › Device ID (random, made by the app): App Functionality
  - User Content › Other User Content (leaderboard nickname): App Functionality
  - Usage Data › Product Interaction (submitted scores and moves): App Functionality
  - Diagnostics › Crash Data, Other Diagnostic Data: App Functionality

## Pictures

| Store | What | Files |
| --- | --- | --- |
| Google Play | App icon 512 x 512 | `play-icon-512.png` |
| Google Play | Feature graphic 1024 x 500 | `feature-graphic-en.png`, `feature-graphic-tr.png` |
| Google Play | Phone screenshots 1080 x 1920 | `screenshots/play-phone/` |
| App Store | iPhone 6.9" screenshots 1320 x 2868 | `screenshots/iphone-6.9/` |
| App Store | iPad 13" screenshots 2064 x 2752 | `screenshots/ipad-13/` |

The App Store icon is in the Xcode project. To redraw the icons:
`npm run app:icons`. To retake the screenshots:
`STORE_SHOTS=1 npx playwright test e2e/store-shots.spec.js`.
