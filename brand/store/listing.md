# Google Play 등록 자료 (폰대시 1.0.0)

Play Console › 폰대시 › **스토어 등록정보** 등에 그대로 붙여 넣을 내용입니다. `<owner>`는 `tools/set-owner.mjs`에 넣은
GitHub 사용자 이름입니다. 데이터 보안과 콘텐츠 등급은 **권장 답변**이고, 제출 책임은 개발자 본인에게 있으니 앱 동작 설명을 읽고
최종 판단하세요.

## 기본 정보

| 항목 | 값 |
|---|---|
| 앱 이름 (30자 이하) | `폰대시: PC 모니터 & AI 사용량 대시보드` |
| 기본 언어 | 한국어 – ko-KR (영어 en-US 번역 추가) |
| 앱/게임 | 앱 |
| 무료/유료 | **유료** (한 번 유료로 출시하면 무료로 바꿀 수는 있어도 다시 유료로 바꿀 수 없습니다) |
| 카테고리 | 도구 (대안: 생산성) |
| 태그 | 시스템 모니터, 위젯, 대시보드 |
| 이메일 | Play 개발자 계정의 연락처 이메일 (공개됨) |
| 웹사이트 | `https://<owner>.github.io/phonedash/` |
| 개인정보처리방침 URL | `https://<owner>.github.io/phonedash/privacy.html` |
| 그래픽 | 아이콘 `brand/out/play-icon-512.png`, 그래픽 이미지 `brand/out/feature-1024x500.png` |
| 휴대전화 스크린샷 | `brand/store/ko/*.png` (한국어 등록정보), `brand/store/en/*.png` (영어), 1920×1080, 6장 |

## 한국어 등록정보

**간단한 설명** (80자 이하)

```
공기계를 PC 옆 대시보드로. CPU·GPU·음악·AI 사용량을 QR 한 번 찍고 한눈에
```

**자세한 설명** (4000자 이하)

```
서랍 속에 잠든 안드로이드 공기계, 모니터 옆에 세워 두고 PC 대시보드로 쓰세요.

폰대시는 컴퓨터의 상태와 자주 쓰는 정보를 공기계 화면 가득 보여 주는 앱입니다. 게임하거나 작업하는 동안 창을 바꾸지 않고도 CPU·GPU 온도, 메모리, 네트워크 속도, 지금 재생 중인 음악, AI 코딩 도구 사용량을 옆 화면에서 바로 확인할 수 있습니다.

■ 이런 걸 보여 줘요
• PC 상태: CPU·GPU 사용률과 온도, 메모리, 디스크, 네트워크 속도와 핑, 무거운 프로세스
• 음악: 지금 재생 중인 곡, 앨범 아트, 재생·건너뛰기·볼륨 조절
• AI 코딩: Claude·Codex 사용량과 초기화 시각, 이 속도면 언제 소진되는지 예측, 실행 중인 코딩 세션
• 생활: 큰 시계, 날씨, 달력, 메모, 체크리스트, 뽀모도로·타이머, 인터넷 라디오
• 터치 버튼: 앱·웹사이트 바로가기, 단축키와 매크로, 앱별 볼륨, 마이크 음소거
• 자동화: 웹후크 알림, Home Assistant 제어, PC 상황에 따라 페이지를 바꾸는 규칙

■ 내 마음대로 꾸미기
126가지 위젯과 30가지 템플릿으로 시작해 PC 브라우저의 편집 화면에서 끌어다 놓기로 배치를 바꿀 수 있습니다. 여러 페이지를 넘겨 보거나, 상황에 따라 자동으로 바뀌게 할 수 있습니다. 가로·세로 화면 모두 지원합니다.

■ 연결은 간단하게
1. 컴퓨터에서 폰대시 사이트(아래 웹사이트 링크)에 들어가 무료 PC 프로그램을 받아 실행합니다. 설치 폴더를 고를 필요 없이 바로 설치되고, 연결용 QR 코드가 화면에 뜹니다.
2. 공기계와 PC를 같은 Wi-Fi에 두고, 공기계 카메라로 QR을 찍습니다.
3. 공기계에 나온 확인 코드가 PC와 같은지 보고 [페어링]을 누르면 끝. 다음부터는 같은 Wi-Fi에 있으면 저절로 연결됩니다.
개발자 옵션도, 케이블도 필요 없어요. 충전하면서 케이블로 쓰고 싶다면 USB 디버깅을 켜고 USB로 연결할 수도 있습니다.

■ 이런 분께 추천해요
• 게임할 때 온도와 프레임 여유를 계속 보고 싶은 분
• Claude Code·Codex로 작업하며 사용량이 신경 쓰이는 개발자
• 책상 위에 작은 보조 화면이 하나 더 있었으면 하는 분
• 바꾸고 남은 공기계를 버리기 아까운 분

■ 안심하고 쓰세요
• 계정·광고·사용 통계가 없습니다. 개발자는 여러분의 데이터를 받지 않습니다.
• PC 정보는 암호화된 Wi-Fi 직접 연결(또는 USB 케이블)로 여러분의 공기계에만 갑니다.
• 루팅이 필요 없습니다.

■ 꼭 확인해 주세요
• Windows 10/11 PC에 무료 PC 프로그램을 설치해야 동작합니다. (앱만으로는 PC 정보를 볼 수 없습니다)
• 공기계는 Android 5.0 이상이면 됩니다. Wi-Fi 연결에는 PC와 같은 네트워크가 필요하고, 케이블 연결을 원하면 USB 디버깅이 필요합니다.
• 일부 정보(GPU 센서, 특정 AI 도구 사용량 등)는 PC 하드웨어와 설치된 프로그램에 따라 표시되지 않을 수 있습니다.

폰대시는 오픈소스 프로젝트 PhoneBox(MIT 라이선스, © Ersin KOÇ)를 바탕으로 만들었습니다. 라이선스 전문은 앱과 웹사이트에 있습니다.
Claude, Codex, Spotify 등은 각 소유자의 상표이며, 폰대시는 이들 회사와 관계가 없습니다.
```

## 영어 등록정보 (en-US)

**App name** (30 characters max): `PhoneDash: PC Stats Dashboard`

**Short description**

```
Turn a spare Android phone into a desk dashboard for your PC over one USB cable
```

**Full description**

```
Give that old Android phone in your drawer a new job: a dashboard next to your monitor.

PhoneDash shows your computer's vital signs and the things you check all day on a full-screen phone panel. See CPU and GPU temperatures, memory, network speed, the song that is playing and your AI coding quotas without switching windows.

WHAT IT SHOWS
• PC stats: CPU and GPU load and temperature, memory, disks, network speed and ping, the heaviest processes
• Music: now playing, album art, play/skip and volume
• AI coding: Claude and Codex quotas, reset times, a forecast of when you will run out, live coding sessions
• Everyday: a big clock, weather, calendars, notes, checklists, pomodoro and timers, internet radio
• Touch buttons: app and website shortcuts, hotkeys and macros, per-app volume, microphone mute
• Automation: webhook notifications, Home Assistant controls, rules that switch pages for you

MAKE IT YOURS
Start from 126 widgets and 30 templates, then rearrange them by drag and drop in the editor that opens in your PC's browser. Swipe between pages or let them switch automatically. Landscape and portrait.

EASY TO CONNECT
1. On the computer, open the PhoneDash website (see the website link below) and run the free PC program. It installs itself and fetches the tools it needs (adb).
2. Turn on USB debugging on the phone (the website shows how).
3. Plug in the USB cable and open the app. Next time it connects by itself.
Prefer Wi-Fi? Scan the QR code in the PC settings with the phone.

PRIVATE BY DESIGN
• No account, no ads, no analytics. The developer never receives your data.
• Your PC's readings go only to your phone, over the USB cable or an encrypted Wi-Fi link.
• No root needed.

PLEASE NOTE
• Requires the free PhoneDash PC program on Windows 10/11. The app alone cannot show PC data.
• Android 5.0 or later. The USB link needs USB debugging.
• Some readings (GPU sensors, some AI tools) depend on your hardware and installed software.

PhoneDash is based on the open-source PhoneBox project (MIT licence, © Ersin KOÇ); the licence text is in the app and on the website. Claude, Codex and Spotify are trademarks of their owners; PhoneDash is not affiliated with them.
```

## 앱 콘텐츠 (정책) — 권장 답변

### 앱 액세스 (심사자 안내)

"일부 기능에 특별한 액세스 권한 필요"를 고르고 아래를 적습니다. 심사자는 PC 프로그램 없이 앱을 열기 때문에, 연결 전 화면이 정상이라는 것과
데모를 보는 방법을 알려 줘야 거절을 피할 수 있습니다.

```
PhoneDash is the phone half of a desktop companion: it displays data sent by the free PhoneDash PC program (Windows) over USB (adb reverse) or the local Wi-Fi network. No account or login exists.
Without the PC program the app shows a "Computer not connected" screen with setup help; this is expected.
To see the full dashboard without a PC: the same panel runs with demo data at https://<owner>.github.io/phonedash/panel/
To test with a PC: download PhoneDash-Setup.exe from https://<owner>.github.io/phonedash/, run it, enable USB debugging on the phone, connect the cable and open the app.
```

### 광고

광고 없음.

### 콘텐츠 등급 (IARC 설문)

- 카테고리: **유틸리티, 생산성, 커뮤니케이션 또는 기타**
- 폭력·성적 콘텐츠·욕설·약물·도박·공포: 모두 **아니요**
- 사용자 간 상호작용/콘텐츠 공유: **아니요** (다른 사용자와 대화하거나 콘텐츠를 주고받는 기능 없음)
- 사용자 위치를 다른 사용자와 공유: **아니요**
- 디지털 상품 구매: **아니요** (앱 내 결제 없음, 앱 자체가 유료)
- 웹 브라우저/검색 기능: **아니요** (인터넷 라디오·뉴스 피드 위젯은 사용자가 정한 주소만 표시)
- 예상 등급: 전체이용가 / PEGI 3 / ESRB Everyone

### 타겟층

- 대상 연령: **18세 이상** (어린이 대상이 아니므로 가족 정책 적용을 피함)
- 어린이에게 호소력이 있을 수 있음: 아니요

### 데이터 보안 (Data safety)

앱이 실제로 하는 일 (자세한 목록은 `PRIVACY.md`):

| 상황 | 폰이 보내는 것 | 받는 곳 |
|---|---|---|
| 평소 | 화면 조작(버튼, 받아쓴 글자 등) | **사용자 본인의 PC** (USB, 또는 PC와 직접 맺은 암호화 Wi-Fi) |
| 날씨·대기질 위젯 | 설정에서 고른 도시의 좌표 (기본값 서울) | open-meteo.com |
| 환율·암호화폐·Hacker News·라디오 위젯을 넣었을 때 | 고른 통화/코인, 라디오 검색어와 방송국 | 각 서비스 |
| 받아쓰기 위젯의 마이크 버튼을 누르고 있을 때 | 음성 (앱이 아니라 폰의 음성 인식 서비스, 보통 Google이 처리) | 폰의 음성 인식 서비스 |
| Wi-Fi 페어링 QR을 찍을 때 | 페이지 요청 (연결 정보는 URL `#` 뒤라 서버로 안 감) | GitHub Pages(폰대시 사이트) |

권장 답변:

1. 데이터 수집 또는 공유 여부: **예**
2. 전송 중 암호화: **예** (외부 서비스는 HTTPS, PC 연결은 TLS. 평문 HTTP는 폰 안의 127.0.0.1만 허용)
3. 계정 생성: **아니요** (계정 없음)
4. 데이터 삭제 요청 방법: 개발자가 보관하는 데이터가 없음 — "앱 삭제 시 폰의 데이터가 모두 지워지며 개발자 서버에 저장되는 데이터는 없음"
5. 데이터 유형:
   - **위치 › 대략적인 위치**: 수집함 / 공유 안 함 / 일시적으로 처리 / 선택사항(날씨 도시를 바꿀 때) / 목적: 앱 기능
   - **오디오 › 음성 또는 사운드 녹음**: 수집함 / 공유 안 함 / 일시적으로 처리 / 선택사항(받아쓰기 위젯) / 목적: 앱 기능
   - 그 외 유형: 수집 안 함. 폰에서 사용자 본인의 PC로 가는 조작 정보는 개발자나 제3자에게 가지 않으므로 넣지 않았습니다. 더 보수적으로
     가려면 **앱 활동 › 앱 상호작용**(수집함, 공유 안 함, 일시적, 필수, 앱 기능)을 추가하세요.

### 기타 선언

- 뉴스 앱: 아니요 · 정부 앱: 아니요 · 금융 기능: 없음 · 건강: 없음
- 민감한 권한: 없음 (RECORD_AUDIO는 별도 선언서가 필요 없는 일반 위험 권한, 받아쓰기 때만 요청)
- 포그라운드 서비스·전체 화면 인텐트·정확한 알람: 사용 안 함

## 가격

- 유료 앱은 Play Console › **수익 창출 설정 › 판매자 프로필**(결제 프로필)을 먼저 만들어야 가격을 정할 수 있습니다.
- 가격은 직접 정하세요. 비슷한 유료 앱 가격을 Play에서 몇 개 찾아보고 정하는 걸 권합니다. 국가별 가격은 Play가 환율로 자동 계산해 줍니다.
- 서비스 수수료와 세금(부가세)은 Play Console › 수익 창출 설정의 안내를 확인하세요.
- 환불: 구매 직후 짧은 기간은 Google Play가 처리합니다. 그 이후 요청은 개발자가 Play Console › 주문 관리에서 직접 환불할 수 있습니다.
