class AgentService {
  constructor() {
    this.baseURL = import.meta.env.VITE_CHAT_API_URL || 'http://chat-app-env.eba-zeuu2iph.eu-north-1.elasticbeanstalk.com';
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
}

export default new AgentService();
