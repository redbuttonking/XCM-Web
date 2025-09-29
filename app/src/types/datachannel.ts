import type { StatusSummary, StatusDetail } from './device';

export type DCMessageType =
  | 'status.summary.push'
  | 'status.summary.req'
  | 'status.summary.res'
  | 'status.detail.req'
  | 'status.detail.res'
  | 'status.heartbeat';

export type DCEnvelope<TType extends DCMessageType, TPayload> = {
  type: TType;
  requestId?: string;
  peerId: string;
  ts: number;
  payload: TPayload;
};

export type RequestStatusSummary = { fields?: (keyof StatusSummary)[] };
export type RequestStatusDetail = { scope?: 'apps' | 'logs' | 'all' };

export type MsgStatusSummaryPush = DCEnvelope<'status.summary.push', StatusSummary>;
export type MsgStatusSummaryReq = DCEnvelope<'status.summary.req', RequestStatusSummary>;
export type MsgStatusSummaryRes = DCEnvelope<'status.summary.res', StatusSummary>;
export type MsgStatusDetailReq = DCEnvelope<'status.detail.req', RequestStatusDetail>;
export type MsgStatusDetailRes = DCEnvelope<'status.detail.res', StatusDetail>;
export type MsgHeartbeat = DCEnvelope<'status.heartbeat', {}>;

export type DCMessage =
  | MsgStatusSummaryPush
  | MsgStatusSummaryReq
  | MsgStatusSummaryRes
  | MsgStatusDetailReq
  | MsgStatusDetailRes
  | MsgHeartbeat;

export const makeEnvelope = <T extends DCMessageType, P>(
  type: T,
  payload: P,
  peerId: string,
  requestId?: string,
): DCEnvelope<T, P> => ({ type, payload, peerId, ts: Date.now(), requestId });

// 타입가드
export const isSummaryPush = (m: any): m is MsgStatusSummaryPush =>
  m?.type === 'status.summary.push';
export const isSummaryRes = (m: any): m is MsgStatusSummaryRes => m?.type === 'status.summary.res';
export const isDetailRes = (m: any): m is MsgStatusDetailRes => m?.type === 'status.detail.res';
export const isHeartbeat = (m: any): m is MsgHeartbeat => m?.type === 'status.heartbeat';
