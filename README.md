# Notikit JavaScript SDKs

| 패키지 | 용도 |
|---|---|
| [`@mint-soft/notikit-core`](packages/sdk-core) | 공통 API 클라이언트·타입 (browser / node / react-native) |
| [`@mint-soft/notikit-web`](packages/sdk-web) | 브라우저 Web Push |
| [`@mint-soft/notikit-react`](packages/sdk-react) | React / Next hooks |
| [`@mint-soft/notikit-react-native`](packages/sdk-react-native) | React Native |

다른 플랫폼: [iOS](https://github.com/mintsoft-opensource/notikit-ios) · [Android](https://github.com/mintsoft-opensource/notikit-android) · [Flutter](https://github.com/mintsoft-opensource/notikit-flutter)

## 개발

```bash
pnpm install
pnpm build   # react → web-sdk → core 가 dist 로 서로를 참조하므로 테스트 전에 빌드
pnpm test
```

실제 서버와의 계약 테스트는 서버가 떠 있을 때만 돈다:

```bash
NOTIKIT_CONTRACT_URL=http://localhost:3000 NOTIKIT_CONTRACT_ADMIN_TOKEN=<ADMIN_TOKEN> pnpm --filter @mint-soft/notikit-core test
```

## 라이선스

Apache-2.0
