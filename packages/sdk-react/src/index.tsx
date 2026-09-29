import * as React from "react";
import { NotikitWeb, type NotikitWebConfig } from "@mint-soft/notikit-web";

const Ctx = React.createContext<NotikitWeb | null>(null);

export function NotikitProvider({
  config,
  children,
}: {
  config: NotikitWebConfig;
  children: React.ReactNode;
}) {
  // NotikitWeb 은 config 를 통째로 붙들고 호출 시점에 읽는다. 여기 빠진 필드는
  // 값이 바뀌어도 인스턴스가 재생성되지 않아 옛 값이 계속 쓰인다 — identityHash 가
  // 비동기로 늦게 도착하는 흔한 경우에 사칭 방지 해시가 영영 undefined 로 나간다.
  //
  // 반대로 **객체·함수를 그대로 의존성에 넣으면** JSX 안에 인라인으로 쓴 설정이
  // 렌더마다 새 인스턴스를 만든다. 인스턴스는 register() 로 받은 토큰과 포그라운드
  // 수신을 들고 있어, 바뀌는 순간 trackConversion 이 깨지고 수신이 끊긴다.
  // 그래서 firebase 는 원시값으로 풀어 비교하고, 함수는 최신 것을 ref 로 불러
  // "있느냐 없느냐"만 의존성으로 삼는다.
  const latest = React.useRef(config);
  latest.current = config;
  const fb = config.firebase;
  const hasGetToken = !!config.getToken;
  const hasFetch = !!config.fetch;
  const hasForeground = !!config.onForegroundMessage;
  const instance = React.useMemo(() => {
    const c = latest.current;
    return new NotikitWeb({
      ...c,
      firebase: c.firebase && { ...c.firebase },
      getToken: hasGetToken ? (reg) => latest.current.getToken!(reg) : undefined,
      fetch: hasFetch ? ((...args) => latest.current.fetch!(...args)) as typeof fetch : undefined,
      onForegroundMessage: hasForeground ? (data) => latest.current.onForegroundMessage?.(data) : undefined,
    });
  }, [
    config.baseUrl,
    config.apiKey,
    config.vapidPublicKey,
    config.userId,
    config.externalId,
    config.identityHash,
    config.serviceWorkerPath,
    config.firebaseSdkVersion,
    fb?.apiKey,
    fb?.projectId,
    fb?.messagingSenderId,
    fb?.appId,
    fb?.authDomain,
    fb?.storageBucket,
    hasGetToken,
    hasFetch,
    hasForeground,
  ]);
  // 교체되거나 언마운트되면 옛 인스턴스의 포그라운드 수신을 뗀다 — 남기면 알림이 두 번 뜬다
  React.useEffect(() => () => instance.unlisten(), [instance]);
  return <Ctx.Provider value={instance}>{children}</Ctx.Provider>;
}

export function useNotikit(): NotikitWeb {
  const v = React.useContext(Ctx);
  if (!v) throw new Error("useNotikit must be used within <NotikitProvider>");
  return v;
}

export type PushRegistrationState = {
  status: "idle" | "registering" | "registered" | "error" | "unsupported";
  token: string | null;
  error: string | null;
  register: () => Promise<void>;
};

/** 푸시 등록 훅 — 버튼에 연결해 권한 요청 + 구독 + 서버 등록 */
export function usePushRegistration(): PushRegistrationState {
  const notikit = useNotikit();
  const [status, setStatus] = React.useState<PushRegistrationState["status"]>(
    NotikitWeb.isSupported() ? "idle" : "unsupported"
  );
  const [token, setToken] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const register = React.useCallback(async () => {
    setStatus("registering");
    setError(null);
    try {
      const t = await notikit.register();
      setToken(t);
      setStatus("registered");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus("error");
    }
  }, [notikit]);

  return { status, token, error, register };
}

export * from "@mint-soft/notikit-core";
