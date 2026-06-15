const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static(path.join(__dirname, 'public')));

const clients = new Set();

// Bancos de dados na memória do servidor para sincronização inicial dos fronts
const devices = {};
const messages = [];

function sendToAll(messageObj, sender = null) {
    const json = JSON.stringify(messageObj);
    clients.forEach(client => {
        if (
            client !== sender &&
            client.readyState === WebSocket.OPEN
        ) {
            client.send(json);
        }
    });
}

wss.on('connection', (ws) => {
    console.log('🔌 Cliente conectado');
    clients.add(ws);
    
    // Entrega o estado atual para quem acabou de conectar
    ws.send(JSON.stringify({ type: 'history', data: messages }));
    ws.send(JSON.stringify({ type: 'devices', data: devices }));

    ws.on('message', (rawMessage) => {
        try {
            const message = JSON.parse(rawMessage);

            // 1. Processo de Registro Interno do Túnel
            if (message.type === 'register' || message.action === 'register') {
                ws.clientType = message.clientType || 'unknown';
                ws.deviceId = message.deviceId || 'unknown';
                console.log(`✅ Registro do Nó: ${ws.deviceId} (${ws.clientType})`);
                return;
            }

            // 2. Monitoramento Passivo de Heartbeats (Para a lista do painel)
            if (message.type === 'heartbeat' && message.deviceId) {
                devices[message.deviceId] = {
                    lastSeen: new Date(),
                    ip: message.ip,
                    hostname: message.hostname,
                    uptime: message.uptime,
                    memory: message.memory,
                    cpuTemp: message.cpuTemp
                };
            }

            // 3. Monitoramento Passivo de Dados de Tópicos (Para o histórico do painel)
            // Se o objeto contiver um tópico e um payload, salvamos no histórico transparente
            if (message.topic && message.payload !== undefined) {
                messages.push(message);
                if (messages.length > 100) messages.shift();
            }

            // 4. RETRANSMISSÃO TRANSPARENTE: Envia o objeto EXATAMENTE como ele chegou
            sendToAll(message, ws);

        } catch (err) {
            console.error('❌ JSON inválido trafegado no túnel:', err.message);
        }
    });

    ws.on('close', () => {
        console.log(`❌ Desconectado: ${ws.deviceId || 'desconhecido'}`);
        clients.delete(ws);
    });
});

app.get('/api/status', (req, res) => {
    res.json({
        status: 'online',
        clients: clients.size,
        devices: Object.keys(devices).length,
        messages: messages.length,
        uptime: process.uptime()
    });
});

const PORT = process.env.PORT || 8000;
server.listen(PORT, () => {
    console.log('🚀 IoT Tunnel transparente iniciado');
    console.log(`🌐 Porta: http://localhost:${PORT}`);
});