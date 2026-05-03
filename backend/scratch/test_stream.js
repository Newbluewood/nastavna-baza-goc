const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function testStream() {
  const url = 'https://chat-agent-kbjc.onrender.com/api/chat/stream';
  console.log('Testing stream at:', url);
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Ispričaj mi ukratko o Goču', history: [] })
    });

    if (!response.ok) {
      console.error('Response not OK:', response.status);
      return;
    }

    const reader = response.body;
    reader.on('data', (chunk) => {
      const text = chunk.toString();
      process.stdout.write(text); // Prikazujemo sirovi strim
    });

    reader.on('end', () => {
      console.log('\n--- Stream finished ---');
    });

  } catch (err) {
    console.error('Test failed:', err);
  }
}

testStream();
