import { useEffect, useState } from 'react';

export type Lang = 'en' | 'zh';

const STORAGE_KEY = 'token-orb:lang';

type Dict = Record<string, string>;

const dicts: Record<Lang, Dict> = {
  en: {
    'ball.label': 'TOKEN',
    'ball.aria': 'Token balance {pct}% remaining',
    'ball.ariaBalance': 'Token balance {pct}% remaining',
    'panel.eyebrow': 'Token Monitor',
    'panel.title': 'Usage overview',
    'panel.remaining': 'Remaining balance',
    'panel.used5h': 'Used (5h)',
    'panel.weeklyUsed': 'Weekly used',
    'panel.lastFetched': 'Last fetched',
    'panel.source': 'Source',
    'panel.refresh': 'Refresh',
    'panel.refreshing': 'Refreshing',
    'panel.hide': 'Hide',
    'panel.closeApp': 'Close',
    'panel.of': 'of {total}% · model {model}',
    'panel.settings': 'Settings',
    'panel.close': 'Close panel',
    'panel.langToggle': 'Switch language',
    'panel.langShort.en': 'EN',
    'panel.langShort.zh': '中',
    'status.idle': 'Idle',
    'status.loading': 'Loading',
    'status.online': 'API Online',
    'status.mock': 'Mock Data',
    'status.unauthorized': 'Token Invalid',
    'status.offline': 'Offline',
    'settings.eyebrow': 'Settings',
    'settings.title': 'Preferences',
    'settings.back': 'Back to token monitor',
    'settings.minimax': 'MiniMax API',
    'settings.tokenHint': 'Token lives in',
    'settings.tokenHintAnd': 'and',
    'settings.tokenHintTail': ', then restart.',
    'settings.baseUrl': 'Base URL',
    'settings.models': 'Models',
    'settings.lastFetch': 'Last fetch',
    'settings.status': 'Status',
    'settings.fetchNow': 'Fetch now',
    'settings.refreshFreq': 'Refresh frequency',
    'settings.refresh.10': 'Every 10 seconds',
    'settings.refresh.30': 'Every 30 seconds',
    'settings.refresh.60': 'Every 60 seconds',
    'settings.refresh.300': 'Every 5 minutes',
    'settings.theme': 'Theme',
    'settings.theme.dark': 'Dark',
    'settings.theme.light': 'Light',
    'settings.status.online': 'MiniMax API responding',
    'settings.status.mock': 'MINIMAX_TOKEN not set; showing mock data',
    'settings.status.unauthorized': 'MINIMAX_TOKEN was rejected (401/403)',
    'settings.status.offline': 'Network or response error',
    'settings.status.loading': 'Loading…',
    'settings.status.idle': 'Idle',
  },
  zh: {
    'ball.label': '额度',
    'ball.aria': '剩余额度 {pct}%',
    'ball.ariaBalance': '剩余额度 {pct}%',
    'panel.eyebrow': '用量监控',
    'panel.title': '使用概览',
    'panel.remaining': '剩余额度',
    'panel.used5h': '5 小时已用',
    'panel.weeklyUsed': '本周已用',
    'panel.lastFetched': '最后更新',
    'panel.source': '数据来源',
    'panel.refresh': '刷新',
    'panel.refreshing': '刷新中',
    'panel.hide': '隐藏',
    'panel.closeApp': '关闭',
    'panel.of': '共 {total}% · 模型 {model}',
    'panel.settings': '设置',
    'panel.close': '关闭面板',
    'panel.langToggle': '切换语言',
    'panel.langShort.en': 'EN',
    'panel.langShort.zh': '中',
    'status.idle': '空闲',
    'status.loading': '加载中',
    'status.online': '接口在线',
    'status.mock': '模拟数据',
    'status.unauthorized': '凭据无效',
    'status.offline': '离线',
    'settings.eyebrow': '设置',
    'settings.title': '偏好',
    'settings.back': '返回用量监控',
    'settings.minimax': 'MiniMax 接口',
    'settings.tokenHint': '凭据存放在',
    'settings.tokenHintAnd': '与',
    'settings.tokenHintTail': '，重启后生效。',
    'settings.baseUrl': '接口地址',
    'settings.models': '模型数量',
    'settings.lastFetch': '最后拉取',
    'settings.status': '状态',
    'settings.fetchNow': '立即拉取',
    'settings.refreshFreq': '刷新频率',
    'settings.refresh.10': '每 10 秒',
    'settings.refresh.30': '每 30 秒',
    'settings.refresh.60': '每 60 秒',
    'settings.refresh.300': '每 5 分钟',
    'settings.theme': '主题',
    'settings.theme.dark': '深色',
    'settings.theme.light': '浅色',
    'settings.status.online': 'MiniMax 接口正常',
    'settings.status.mock': '未配置 MINIMAX_TOKEN，显示模拟数据',
    'settings.status.unauthorized': 'MINIMAX_TOKEN 被拒绝（401/403）',
    'settings.status.offline': '网络或响应异常',
    'settings.status.loading': '加载中…',
    'settings.status.idle': '空闲',
  },
};

const readStoredLang = (): Lang => {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value === 'zh' ? 'zh' : 'en';
  } catch {
    return 'en';
  }
};

let currentLang: Lang = readStoredLang();
const listeners = new Set<(lang: Lang) => void>();

const persistLang = (lang: Lang): void => {
  try {
    window.localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // ignore storage failures (e.g. private mode); in-memory state still updates
  }
};

export const getLang = (): Lang => currentLang;

export const setLang = (lang: Lang): void => {
  if (lang === currentLang) return;
  currentLang = lang;
  persistLang(lang);
  listeners.forEach((listener) => listener(lang));
};

export const useLang = (): Lang => {
  const [lang, setLocalLang] = useState<Lang>(currentLang);
  useEffect(() => {
    const listener = (next: Lang): void => setLocalLang(next);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);
  return lang;
};

const interpolate = (template: string, vars: Record<string, string | number>): string => {
  return Object.entries(vars).reduce<string>(
    (acc, [key, value]) => acc.split(`{${key}}`).join(String(value)),
    template,
  );
};

export const useT = (): ((
  key: string,
  vars?: Record<string, string | number>,
) => string) => {
  const lang = useLang();
  return (key, vars) => {
    const template = dicts[lang][key] ?? dicts.en[key] ?? key;
    return vars ? interpolate(template, vars) : template;
  };
};

export const translate = (
  lang: Lang,
  key: string,
  vars?: Record<string, string | number>,
): string => {
  const template = dicts[lang][key] ?? dicts.en[key] ?? key;
  return vars ? interpolate(template, vars) : template;
};