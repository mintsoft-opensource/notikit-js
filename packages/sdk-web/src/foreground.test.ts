import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

// 포그라운드 수신은 firebase 모듈을 동적 import 한다. 모듈을 대신해 onMessage 핸들러를 붙잡는다.
const fb = vi.hoisted(() => ({
  apps: [] as { name: string; options: { projectId?: string; appId?: string } }[],
  handler: null as ((payload: { data?: Record<string, string> }) => void) | null,
  initializeApp: vi.fn(),
}));

vi.mock("firebase/app", () => ({
  getApps: () => fb.apps,
  getApp: () => {
    // 기본 앱이 없으면 실제 SDK 처럼 던진다 — SDK 는 이름 붙은 앱("notikit")을 만든다
    const app = fb.apps.find((a) => a.name === "[DEFAULT]");
    if (!app) throw new Error("app/no-app");
    return app;
  },
  initializeApp: (options: { projectId?: string; appId?: string }, name = "[DEFAULT]") => {
    fb.initializeApp(options, name);
    const app = { name, options };
    fb.apps.push(app);
    return app;
  },
}));

vi.mock("firebase/messaging", () => ({
  getMessaging: (app: unknown) => ({ app }),
  getToken: async () => "fcm-token-1",
  isSupported: async () => true,
  onMessage: (_m: unknown, h: (payload: { data?: Record<string, string> }) => void) => {
    fb.handler = h;
    return () => {
      fb.handler = null;
    };
  },
}));

import { NotikitWeb } from "./index";

const base = {
  baseUrl: "https://push.test",
  apiKey: "nk_test",
  vapidPublicKey: "q_-A",
  firebase: {
    apiKey: "AIza-test",
    projectId: "p-test",
    messagingSenderId: "1234567890",
    appId: "1:1234567890:web:abc",
  },
};

const okFetch = () =>
  vi.fn(async () =>
    new Response(JSON.stringify({ success: true, data: { device: { id: "d1" } }, error: null }), { status: 200 })
  ) as unknown as typeof fetch;

function installEnv() {
  const showNotification = vi.fn(async () => {});
  const registration = { showNotification };
  const NotificationCtor = vi.fn();
  Object.assign(NotificationCtor, { requestPermission: vi.fn(async () => "granted") });
  vi.stubGlobal("navigator", {
    language: "ko-KR",
    serviceWorker: {
      register: vi.fn(async () => registration),
      ready: Promise.resolve(registration),
      getRegistration: vi.fn(async () => undefined),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    },
  });
  vi.stubGlobal("location", { href: "https://site.test/app" });
  vi.stubGlobal("PushManager", class {});
  vi.stubGlobal("Notification", NotificationCtor);
  vi.stubGlobal("indexedDB", {
    open: () => {
      const req: Record<string, unknown> = { error: new Error("no idb") };
      setTimeout(() => (req.onerror as (() => void) | null)?.(), 0);
      return req;
    },
  });
  return { showNotification, NotificationCtor };
}

beforeEach(() => {
  fb.apps.length = 0;
  fb.handler = null;
  fb.initializeApp.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("NotikitWeb 포그라운드 수신", () => {
  it("SDK 가 만든 이름 붙은 앱으로도 onMessage 를 붙인다", async () => {
    // 기본 경로에서 SDK 는 initializeApp(cfg, "notikit") 로 만든다 — 기본 앱이 없다
    installEnv();
    await new NotikitWeb({ ...base, fetch: okFetch() }).register();

    expect(fb.handler).not.toBeNull();
    // 토큰 획득 때 만든 앱을 다시 쓴다 — 두 번 초기화하지 않는다
    expect(fb.initializeApp).toHaveBeenCalledTimes(1);
  });

  it("getToken 을 앱이 대신해도 같은 프로젝트의 앱을 찾아 붙는다", async () => {
    installEnv();
    fb.apps.push({ name: "host", options: { projectId: base.firebase.projectId, appId: base.firebase.appId } });
    await new NotikitWeb({ ...base, getToken: async () => "fcm-token-1", fetch: okFetch() }).register();

    expect(fb.handler).not.toBeNull();
    expect(fb.initializeApp).not.toHaveBeenCalled();
  });

  it("기본 처리는 서비스워커 등록으로 알림을 띄운다 — Notification 생성자는 쓰지 않는다", async () => {
    // 안드로이드 크롬은 new Notification() 을 Illegal constructor 로 막는다
    const env = installEnv();
    await new NotikitWeb({ ...base, fetch: okFetch() }).register();

    fb.handler!({ data: { title: "제목", body: "본문", notikit_log_id: "log-1", deep_link: "/promo" } });
    await vi.waitFor(() => expect(env.showNotification).toHaveBeenCalled());

    const [title, options] = env.showNotification.mock.calls[0] as unknown as [string, NotificationOptions];
    expect(title).toBe("제목");
    expect(options.body).toBe("본문");
    // 워커의 notificationclick 이 이 값으로 클릭을 보고하고 이동한다
    expect(options.data).toMatchObject({ deep_link: "/promo", notikit_log_id: "log-1" });
    expect(env.NotificationCtor).not.toHaveBeenCalled();
  });

  it("무음 푸시(제목·본문 없음)는 알림을 띄우지 않는다", async () => {
    const env = installEnv();
    await new NotikitWeb({ ...base, fetch: okFetch() }).register();

    fb.handler!({ data: { notikit_log_id: "log-2", kind: "sync" } });
    await new Promise((r) => setTimeout(r, 0));

    expect(env.showNotification).not.toHaveBeenCalled();
    expect(env.NotificationCtor).not.toHaveBeenCalled();
  });

  it("onForegroundMessage 를 넘기면 그쪽으로만 보낸다", async () => {
    const env = installEnv();
    const onForegroundMessage = vi.fn();
    await new NotikitWeb({ ...base, onForegroundMessage, fetch: okFetch() }).register();

    fb.handler!({ data: { title: "제목", notikit_log_id: "log-3" } });

    expect(onForegroundMessage).toHaveBeenCalledWith({ title: "제목", notikit_log_id: "log-3" });
    expect(env.showNotification).not.toHaveBeenCalled();
  });
});
