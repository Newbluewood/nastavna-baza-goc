// Standalone test for /weather/forecast endpoint
const http = require('http');

function testWeatherForecast(days = 7) {
  const path = days === 7 ? '/api/weather/forecast' : `/api/weather/forecast?days=${days}`;
  const options = {
    hostname: '127.0.0.1',
    port: 3000,
    path,
    method: 'GET',
  };
  const req = http.request(options, (res) => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
      console.log(`✔ Status: ${res.statusCode} for ${path}`);
      try {
        const json = JSON.parse(body);
        console.log('✔ Response:', json);
        if (json.days === days) {
          console.log(`✔ Correct days: ${json.days}`);
        } else {
          console.log(`❗ Wrong days: expected ${days}, got ${json.days}`);
        }
      } catch (e) {
        console.error('❗ Failed to parse JSON:', e);
      }
    });
  });
  req.on('error', (e) => {
    console.error(`❗ Problem with request: ${e.message}`);
  });
  req.end();
}

testWeatherForecast(7);
testWeatherForecast(3);
