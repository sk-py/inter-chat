export interface UIMessagePart {
  type: 'text';
  text: string;
}

export interface UIMessage {
  id: string;
  role: 'user' | 'assistant';
  parts: UIMessagePart[];
}