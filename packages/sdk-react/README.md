# @mint-soft/notikit-react

> Notikit React SDK — Web SDK 위의 hooks (Next.js 호환).

## 설치
```bash
npm install @mint-soft/notikit-react
```

## 사용
```tsx
"use client";
import { NotikitProvider, usePushRegistration } from "@mint-soft/notikit-react";

function PushButton() {
  const { status, register, error } = usePushRegistration();
  return (
    <button onClick={register} disabled={status === "registering"}>
      {status === "registered" ? "알림 켜짐 ✓" : "알림 받기"}
      {error && <span> — {error}</span>}
    </button>
  );
}

export default function App() {
  return (
    <NotikitProvider
      config={{
        baseUrl: "https://push.example.com",
        apiKey: "nk_xxx",
        vapidPublicKey: "BÖ...",
        // 필수 — 서비스워커가 이 값으로 Firebase 를 초기화해야 백그라운드 푸시를 받는다.
        // Firebase 콘솔 > 프로젝트 설정 > 내 앱(웹)의 구성값 그대로. 모두 공개값이다.
        firebase: {
          apiKey: "AIza...",
          projectId: "my-project",
          messagingSenderId: "1234567890",
          appId: "1:1234567890:web:abc123",
        },
        userId: "user-123", // 고객 서비스의 유저 id (서버에는 user_id 로 전송)
      }}
    >
      <PushButton />
    </NotikitProvider>
  );
}
```

## API
| | 설명 |
|---|---|
| `<NotikitProvider config>` | 컨텍스트 제공 |
| `useNotikit()` | `NotikitWeb` 인스턴스 |
| `usePushRegistration()` | `{ status, token, error, register }` |

`config` 는 `@mint-soft/notikit-web` 의 `NotikitWebConfig` 입니다. 위처럼 JSX 안에 인라인으로 써도
됩니다 — 렌더마다 객체·함수가 새로 만들어져도 **값이 같으면 같은 인스턴스를 유지**합니다(등록한 토큰과
포그라운드 수신이 유지됨). `baseUrl`·`apiKey`·`firebase` 값·`userId`·`identityHash` 등이 실제로 바뀔 때만
새 인스턴스를 만들며, 그때는 `register()` 를 다시 불러야 합니다. 이전 이름 `externalId`(`external_id`)도 그대로
동작하지만 deprecated 입니다 — `userId` 를 쓰세요.

## 라이선스
Apache-2.0
