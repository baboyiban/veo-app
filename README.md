# Veo 3 Next.js 앱

Veo 3 (Preview)을 Gemini API로 호출해 8초 720p 영상(오디오 포함)을 생성하는 Next.js 14 앱입니다. 텍스트→비디오, 이미지→비디오를 지원하며 비동기 작업을 폴링해 결과를 다운로드합니다.

## 준비
1) .env.local 생성
```
GEMINI_API_KEY=YOUR_API_KEY
```

2) 설치/실행 (bun 또는 npm 중 택1)
```
bun install
bun run dev
```

## 주요 기능
- 모델: veo-3.0-generate-preview 또는 veo-3.0-fast-generate-preview
- negativePrompt, personGeneration(지역 제한 유의)
- 이미지 업로드 후 image-to-video
- 상태 폴링 후 파일 다운로드

## 엔드포인트
- POST /api/video/start: 작업 시작
- GET  /api/video/status?name=...: 상태 조회
- GET  /api/video/download?fileUri=...: 결과 다운로드/리다이렉트
- POST /api/files/upload: 이미지 파일 업로드

## 주의
- 미리보기 모델은 가용성/응답 형식이 변할 수 있습니다.
- 파일은 Google 측에서 48시간 내 삭제될 수 있으니 즉시 다운로드하세요.
