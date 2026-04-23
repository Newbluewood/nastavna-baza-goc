// Standalone test for local Python embedding service
const fetch = require('node-fetch');

(async () => {
  try {
    const response = await fetch('http://127.0.0.1:8000/embed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'This is a test sentence for embedding.' })
    });
    if (!response.ok) {
      console.log(`❗ HTTP error: ${response.status}`);
      return;
    }
    const data = await response.json();
    if (Array.isArray(data.embedding) && data.embedding.length > 0 && typeof data.embedding[0] === 'number') {
      console.log('✔ Valid embedding vector received');
    } else {
      console.log('❗ Invalid embedding vector:', data);
    }
  } catch (e) {
    console.error('❗ Test error:', e);
  }
})();
