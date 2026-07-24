import { motion, useReducedMotion } from 'framer-motion';
import { useState } from 'react';
import { useTokenStore } from '../store/tokenStore';
import { getBalanceRingBgClass, getBalanceStroke, getBalanceTextClass } from '../lib/balanceColor';
import { normalizeRefreshError, type RefreshErrorCode } from '../lib/refreshReliability';
import { getLang, setLang, type Lang, useT } from '../i18n';

type TokenPanelProps = {
  onClose: () => void;
  onQuit: () => void;
  onRefresh: () => Promise<void>;
  onSettings: () => void;
};

type ManualRefreshFeedback = { kind: 'success' } | { kind: 'error'; code: RefreshErrorCode } | null;

const numberFormatter = new Intl.NumberFormat('en-US');

const formatNumber = (value: number): string => numberFormatter.format(value);

const formatTimestamp = (timestamp: number | null): string => {
  if (!timestamp) return '—';
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

type StatusKey = 'idle' | 'loading' | 'online' | 'mock' | 'unauthorized' | 'offline';

const statusDotMap: Record<StatusKey, string> = {
  idle: 'status-dot-idle',
  loading: 'status-dot-loading',
  online: 'status-dot-online',
  mock: 'status-dot-mock',
  unauthorized: 'status-dot-unauthorized',
  offline: 'status-dot-offline',
};

const langOptions: Lang[] = ['en', 'zh'];

export const TokenPanel = ({ onClose, onQuit, onRefresh, onSettings }: TokenPanelProps) => {
  const { snapshot, percentage, totalPercent, isLoading, lastFetchedAt, status, error, errorCode } =
    useTokenStore();
  const t = useT();
  const shouldReduceMotion = useReducedMotion();
  const [refreshFeedback, setRefreshFeedback] = useState<ManualRefreshFeedback>(null);
  const statusKey = (status as StatusKey) ?? 'idle';
  const statusDot = statusDotMap[statusKey] ?? statusDotMap.idle;
  const statusLabel = t(`status.${statusKey}`);
  const primary = snapshot?.primary ?? null;
  const usedNumeric = Math.max(0, totalPercent - percentage);
  const weeklyUsed = primary?.weeklyUsedPercent ?? 0;
  const ringColor = getBalanceStroke(percentage);
  const ringBg = getBalanceRingBgClass(percentage);
  const ringText = getBalanceTextClass(percentage);
  const lang = getLang();
  const storeError = errorCode ? t(`refresh.error.${errorCode}`) : error;

  const handleRefresh = async (): Promise<void> => {
    setRefreshFeedback(null);
    try {
      await onRefresh();
      setRefreshFeedback({ kind: 'success' });
    } catch (refreshError: unknown) {
      setRefreshFeedback({ kind: 'error', code: normalizeRefreshError(refreshError).code });
    }
  };

  const feedbackMessage =
    refreshFeedback?.kind === 'success'
      ? t('panel.refreshSuccess')
      : refreshFeedback?.kind === 'error'
        ? t(`refresh.error.${refreshFeedback.code}`)
        : null;

  return (
    <motion.section
      className="glass-panel panel-text flex w-[340px] flex-col rounded-2xl p-5"
      initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.92, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.22, ease: 'easeOut' }}
    >
      <header className="flex items-start justify-between">
        <div>
          <p className="panel-eyebrow text-[10px] font-semibold uppercase tracking-[0.22em]">
            {t('panel.eyebrow')}
          </p>
          <h1 className="panel-text-strong mt-1 text-xl font-semibold tracking-tight">
            {t('panel.title')}
          </h1>
        </div>
        <div className="flex items-center gap-1">
          <div
            role="group"
            aria-label={t('panel.langToggle')}
            className="panel-control-group flex items-center rounded-lg p-0.5 text-[11px] font-medium"
          >
            {langOptions.map((option) => {
              const isActive = lang === option;
              return (
                <button
                  key={option}
                  type="button"
                  aria-pressed={isActive}
                  aria-label={t('panel.langToggle')}
                  className={`panel-segment-button min-w-[28px] rounded-md px-1.5 py-1 ${
                    isActive ? 'panel-segment-button-active' : ''
                  }`}
                  onClick={() => setLang(option)}
                >
                  {t(`panel.langShort.${option}`)}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            aria-label={t('panel.settings')}
            title={t('panel.settings')}
            className="panel-icon-button rounded-lg p-2"
            onClick={onSettings}
          >
            <svg
              className="h-4 w-4"
              viewBox="0 0 1024 1024"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                d="M1072.147851 406.226367c-6.331285-33.456782-26.762037-55.073399-52.047135-55.073399-0.323417 0-0.651455 0.003081-0.830105 0.009241l-4.655674 0c-73.124722 0-132.618162-59.491899-132.618162-132.618162 0-23.731152 11.447443-50.336101 11.546009-50.565574 13.104573-29.498767 3.023185-65.672257-23.427755-84.127081l-1.601687-1.127342-134.400039-74.661726-1.700252-0.745401c-8.753836-3.805547-18.334698-5.735272-28.479231-5.735272-20.789593 0-41.235746 8.344174-54.683758 22.306575-14.741683 15.216028-65.622973 58.649474-104.721083 58.649474-39.450789 0-90.633935-44.286652-105.438762-59.784516-13.518857-14.247316-34.128258-22.753199-55.127302-22.753199-9.945862 0-19.354234 1.861961-27.958682 5.531982l-1.746455 0.74078-139.141957 76.431283-1.643269 1.139662c-26.537186 18.437884-36.675557 54.579032-23.584845 84.062398 0.115506 0.264895 11.579891 26.725075 11.579891 50.634877 0 73.126262-59.491899 132.618162-132.618162 132.618162l-4.581749 0c-0.318797-0.00616-0.636055-0.01078-0.951772-0.01078-25.260456 0-45.672728 21.618157-52.002472 55.0811-0.462025 2.453354-11.313456 60.622322-11.313456 106.117939 0 45.494078 10.85143 103.659965 11.314996 106.119479 6.334365 33.458322 26.758957 55.076479 52.036353 55.076479 0.320337 0 0.651455-0.00616 0.842426-0.012321l4.655674 0c73.126262 0 132.618162 59.491899 132.618162 132.616622 0 23.760413-11.444363 50.333021-11.546009 50.565574-13.093793 29.474125-3.041666 65.646075 23.395414 84.151722l1.569346 1.093459 131.838879 73.726895 1.675611 0.7377c8.750757 3.84251 18.305437 5.790715 28.397607 5.790715 21.082208 0 41.676209-8.706094 55.0888-23.290689 18.724339-20.347588 69.527086-62.362616 107.04815-62.362616 40.625872 0 92.72537 47.100385 107.759669 63.583903 13.441852 14.831008 34.176001 23.689571 55.470741 23.695731l0.00616 0c9.895039 0 19.27877-1.883523 27.893999-5.598205l1.711034-0.73924 136.659342-75.531873 1.617088-1.128882c26.492523-18.456365 36.601633-54.600594 23.538642-84.016195-0.115506-0.267974-11.595291-27.082374-11.595291-50.67646 0-73.124722 59.49344-132.616622 132.618162-132.616622l4.517066-0.00154c0.300316 0.00616 0.599092 0.009241 0.899409 0.009241 25.331299-0.00154 45.785153-21.619697 52.107197-55.054918 0.112426-0.589852 11.325776-59.507301 11.325776-106.14104C1083.464388 466.640776 1072.609877 408.67356 1072.147851 406.226367zM377.486862 945.656142l-115.32764-64.487932c5.082277-13.052211 15.437801-43.51815 15.437801-75.017486 0-109.382917-84.176364-199.816642-192.587488-208.134635-2.647404-15.427021-8.873963-54.967133-8.873963-85.667166 0-30.65691 6.223479-70.232445 8.869343-85.671786 108.415744-8.311832 192.592108-98.745557 192.592108-208.134635 0-31.416171-10.300081-61.797405-15.371577-74.854236l122.721583-67.40331c0.003081 0 0.00462 0.00154 0.007701 0.00154 4.423121 4.518606 22.121764 22.080182 46.558275 39.493911 39.929754 28.46229 77.952885 42.894416 113.014434 42.894416 34.716571 0 72.437845-14.151831 112.115025-42.06431 24.282503-17.07953 41.896442-34.302288 46.308782-38.74543 0.009241-0.00154 0.018481-0.00462 0.026182-0.00616l118.301542 65.726159c-5.077657 13.055291-15.416239 43.499669-15.416239 74.958962 0 109.389077 84.174824 199.822802 192.590568 208.134635 2.645865 15.462442 8.872423 55.107281 8.872423 85.671786 0 30.687711-6.223479 70.241685-8.869343 85.673326C890.042174 606.334084 805.86427 696.767809 805.86427 806.158426c0 31.450053 10.317022 61.851309 15.393138 74.903519l-119.783103 66.198965c-5.168521-5.490399-22.603811-23.363073-46.740005-41.288109-40.701336-30.224145-79.662378-45.549521-115.800446-45.549521-35.79155 0-74.458435 15.038919-114.927219 44.694774C400.22004 922.554885 382.666163 940.255068 377.486862 945.656142zM731.271848 511.646647c0-105.803762-86.081448-191.88059-191.888289-191.88059-105.803762 0-191.88059 86.076827-191.88059 191.88059 0 105.803762 86.076827 191.882129 191.88059 191.882129C645.19194 703.528777 731.271848 617.450409 731.271848 511.646647zM539.383558 395.903184c63.825696 0 115.751164 51.922387 115.751164 115.743463 0 63.825696-51.925468 115.751164-115.751164 115.751164-63.821076 0-115.743463-51.925468-115.743463-115.751164C423.640095 447.824031 475.562482 395.903184 539.383558 395.903184z"
                fill="currentColor"
              />
            </svg>
          </button>
          <button
            type="button"
            aria-label={t('panel.close')}
            title={t('panel.close')}
            className="panel-icon-button rounded-lg p-2"
            onClick={onClose}
          >
            <svg
              className="h-4 w-4"
              viewBox="0 0 1024 1024"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                d="M585.412525 512.594747L973.601616 124.418586c19.600808-19.600808 19.600808-51.898182 0-71.49899l-2.120404-2.120404c-19.600808-19.600808-51.898182-19.600808-71.49899 0L511.793131 439.518384 123.61697 50.799192c-19.600808-19.600808-51.898182-19.600808-71.49899 0l-2.120404 2.120404c-20.11798 19.600808-20.11798 51.898182 0 71.49899l388.189091 388.189091L49.997576 900.783838c-19.587879 19.600808-19.587879 51.898182 0 71.49899l2.120404 2.120404c19.600808 19.600808 51.898182 19.600808 71.49899 0L511.793131 586.214141l388.189091 388.176162c19.600808 19.600808 51.898182 19.600808 71.49899 0l2.120404-2.120404c19.600808-19.600808 19.600808-51.898182 0-71.49899L585.412525 512.594747z m0 0"
                fill="currentColor"
              />
            </svg>
          </button>
        </div>
      </header>

      <div className="panel-surface mt-6 flex items-center gap-4 rounded-xl p-4">
        <div
          className={`relative flex h-16 w-16 shrink-0 items-center justify-center rounded-full ${ringBg}`}
        >
          <svg
            className="absolute inset-0 h-full w-full -rotate-90"
            viewBox="0 0 64 64"
            aria-hidden="true"
          >
            <circle
              className="balance-ring-track"
              cx="32"
              cy="32"
              r="25"
              fill="none"
              strokeWidth="4"
            />
            <motion.circle
              cx="32"
              cy="32"
              r="25"
              fill="none"
              stroke={ringColor}
              strokeLinecap="round"
              strokeWidth="4"
              strokeDasharray={2 * Math.PI * 25}
              animate={{
                stroke: ringColor,
                strokeDashoffset: 2 * Math.PI * 25 * (1 - percentage / 100),
              }}
              transition={
                shouldReduceMotion ? { duration: 0 } : { duration: 0.45, ease: 'easeOut' }
              }
            />
          </svg>
          <span className={`text-sm font-semibold ${ringText}`}>{percentage}%</span>
        </div>
        <div>
          <p className="panel-muted text-xs">{t('panel.remaining')}</p>
          <p className="panel-text-strong mt-1 text-2xl font-semibold tracking-tight">
            {formatNumber(percentage)}
          </p>
          <p className="panel-muted mt-1 text-[11px]">
            {t('panel.of', {
              total: formatNumber(totalPercent),
              model: primary?.model ?? '—',
            })}
          </p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="panel-surface rounded-xl p-3">
          <p className="panel-muted text-[11px]">{t('panel.used5h')}</p>
          <p className="panel-text-strong mt-2 text-lg font-semibold">
            {formatNumber(usedNumeric)}%
          </p>
        </div>
        <div className="panel-surface rounded-xl p-3">
          <p className="panel-muted text-[11px]">{t('panel.weeklyUsed')}</p>
          <p className="panel-text-strong mt-2 text-lg font-semibold">
            {formatNumber(weeklyUsed)}%
          </p>
        </div>
      </div>

      <div className="panel-surface mt-4 rounded-xl p-3 text-[11px] leading-relaxed">
        <div className="flex items-center justify-between">
          <span className="panel-muted">{t('panel.lastFetched')}</span>
          <span className="panel-text-strong font-medium">{formatTimestamp(lastFetchedAt)}</span>
        </div>
        <div className="mt-1 flex items-center justify-between">
          <span className="panel-muted">{t('panel.source')}</span>
          <span className="panel-text-strong font-medium">{snapshot?.baseUrl ?? '—'}</span>
        </div>
        {feedbackMessage ? (
          <p
            role={refreshFeedback?.kind === 'error' ? 'alert' : 'status'}
            className={`panel-feedback mt-2 ${
              refreshFeedback?.kind === 'error' ? 'panel-feedback-error' : 'panel-feedback-success'
            }`}
          >
            {feedbackMessage}
          </p>
        ) : storeError ? (
          <p role="alert" className="panel-feedback panel-feedback-error mt-2">
            {storeError}
          </p>
        ) : null}
      </div>

      <div className="panel-divider-top mt-5 flex items-center justify-between pt-4">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${statusDot}`} aria-hidden="true" />
          <span className="panel-muted text-xs font-medium">{statusLabel}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="panel-danger-button rounded-lg px-3 py-2 text-xs font-medium"
            onClick={onQuit}
          >
            {t('panel.closeApp')}
          </button>
          <button
            type="button"
            className="panel-primary-button rounded-lg px-3 py-2 text-xs font-semibold"
            disabled={isLoading}
            onClick={() => void handleRefresh()}
          >
            {isLoading ? t('panel.refreshing') : t('panel.refresh')}
          </button>
        </div>
      </div>
    </motion.section>
  );
};
