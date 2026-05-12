'use strict';

const fetch = require('node-fetch');
const logger = require('../logger');

const GEMINI_API_KEY   = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
const GEMINI_CHAT_MODEL = process.env.GEMINI_CHAT_MODEL || 'gemini-2.5-flash';
const GEMINI_TIMEOUT_MS = 12_000;

function buildUrl() {
  const model = GEMINI_CHAT_MODEL.startsWith('models/') ? GEMINI_CHAT_MODEL : `models/${GEMINI_CHAT_MODEL}`;
  return `https://generativelanguage.googleapis.com/v1beta/${model}:generateContent?key=${GEMINI_API_KEY}`;
}

function extractDataFromText(text) {
    const data = {};
    if (!text) return data;
    const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    if (emailMatch) data.guest_email = emailMatch[0];
    const dateMatches = text.match(/\d{4}-\d{2}-\d{2}/g);
    if (dateMatches && dateMatches.length >= 2) {
        data.check_in = dateMatches[0];
        data.check_out = dateMatches[1];
    }
    const phoneMatch = text.match(/06\d{7,9}/);
    if (phoneMatch) data.guest_phone = phoneMatch[0];
    const nameMatch = text.match(/(?:Ime|Gost|Klijent)\s*(?:i?\s*prezime)?:\s*([^\n\r|*]+)/i);
    if (nameMatch) data.guest_name = nameMatch[1].trim();
    const roomMatch = text.match(/Soba:\s*([^\n\r|*]+)/i);
    if (roomMatch) data.target_room = roomMatch[1].trim();
    if (text.toLowerCase().includes("pun pansion")) data.board_type = "full";
    else if (text.toLowerCase().includes("polupansion")) data.board_type = "half";
    else if (text.toLowerCase().includes("noćenje")) data.board_type = "base";
    return data;
}

async function callGemini(systemPrompt, contents, tools = null) {
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not configured');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);
  try {
    const payload = {
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: contents,
      generationConfig: { maxOutputTokens: 1000, temperature: 0.7 },
    };
    if (tools) payload.tools = tools;
    const response = await fetch(buildUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error?.message || `Gemini HTTP ${response.status}`);
    const candidate = data?.candidates?.[0];
    const part = candidate?.content?.parts?.[0];
    let reply = "";
    let action = null;
    if (part?.text) reply = part.text.trim();
    if (part?.functionCall) {
      const call = part.functionCall;
      if (call.name === 'ponudi_rezervaciju') {
        const emergencyData = extractDataFromText(reply);
        action = {
          type: 'open_reservation_form',
          target_room:  call.args.room_name || emergencyData.target_room || null,
          room_id:      call.args.room_id || null,
          check_in:     call.args.check_in || emergencyData.check_in || '',
          check_out:    call.args.check_out || emergencyData.check_out || '',
          board_type:   call.args.board_type || emergencyData.board_type || 'base',
          guest_name:   call.args.guest_name || emergencyData.guest_name || '',
          guest_email:  call.args.guest_email || emergencyData.guest_email || '',
          guest_phone:  call.args.guest_phone || emergencyData.guest_phone || ''
        };
        if (!reply) reply = "Naravno, otvaram vam formu za rezervaciju sa navedenim detaljima.";
      }
    }
    return { reply, action };
  } finally { clearTimeout(timer); }
}

async function askGemini(message, history = []) {
  const systemPrompt = `Ti si Kozak, asistent za Nastavnu bazu Goč. Ako korisnik želi rezervaciju, iskoristi alat 'ponudi_rezervaciju'.`;
  const reservationTool = [{
    function_declarations: [{
      name: "ponudi_rezervaciju",
      parameters: {
        type: "object",
        properties: {
          room_name: { type: "string" },
          check_in: { type: "string" },
          check_out: { type: "string" },
          board_type: { type: "string", enum: ["base", "half", "full"] },
          guest_name: { type: "string" },
          guest_email: { type: "string" },
          guest_phone: { type: "string" }
        },
        required: ["room_name"]
      }
    }]
  }];
  const contents = (history || []).map(h => ({
    role: h.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: h.content }]
  }));
  while (contents.length > 0 && contents[0].role === 'model') contents.shift();
  contents.push({ role: 'user', parts: [{ text: message }] });
  return callGemini(systemPrompt, contents, reservationTool);
}

module.exports = { askGemini };
