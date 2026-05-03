class AgentService {
  constructor() {
    this.baseURL = import.meta.env.VITE_CHAT_API_URL || 'https://chat-agent-kbjc.onrender.com';
  }

  async sendMessage(message, history = [], lang = 'sr') {
    const response = await fetch(`${this.baseURL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ message, history, lang })
    });

    if (!response.ok) {
      if (response.status === 429) {
         throw new Error('Rate limit exceeded. Please try again later.');
      }
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error ${response.status}`);
    }

    return response.json();
  }

  async sendMessageStream(message, history = [], lang = 'sr', onChunk, onAction) {
    const response = await fetch(`${this.baseURL}/api/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ message, history, lang })
    });

    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      
      // Keep the last partial line in the buffer
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine || !trimmedLine.startsWith('data: ')) continue;
        
        const dataStr = trimmedLine.replace('data: ', '').trim();
        if (dataStr === '[DONE]') continue;

        try {
          const data = JSON.parse(dataStr);
          if (data.type === 'text') {
            onChunk(data.content);
          } else if (data.type === 'action') {
            onAction(data.content);
          } else if (data.type === 'error') {
            throw new Error(data.content);
          }
        } catch (e) {
          console.warn('[AgentService] Failed to parse SSE data:', dataStr);
        }
      }
    }
  }
}

export default new AgentService();
