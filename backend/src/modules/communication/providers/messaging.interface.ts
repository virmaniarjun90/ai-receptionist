export type SendMessageInput = {
  to: string;
  body: string;
};

export const MESSAGING_PROVIDER = Symbol('MESSAGING_PROVIDER');

export interface MessagingProvider {
  sendMessage(input: SendMessageInput): Promise<void>;
}
