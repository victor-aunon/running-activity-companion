export * from '@running-support/shared-contracts';

export interface CheerItem {
  notificationId: string;
  senderName: string;
  body: string;
  status: 'ENVIADO' | 'EN_RELOJ' | 'AGRADECIDO' | 'EXPIRADO';
  runnerReplyText?: string;
  timestamp: number;
}
