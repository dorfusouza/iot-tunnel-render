const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static('public'));

const clients = new Set();

function sendToAll(message, sender = null) {

    const json = JSON.stringify(message);

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

    ws.on('message', (rawMessage) => {

        try {

            const message = JSON.parse(rawMessage);

            if (message.action === 'register') {

                ws.clientType = message.clientType || 'unknown';
                ws.deviceId = message.deviceId || 'unknown';

                console.log(
                    `✅ Registro: ${ws.deviceId} (${ws.clientType})`
                );

                return;
            }

            sendToAll(message, ws);

        } catch (err) {

            console.error(
                '❌ JSON inválido:',
                err.message
            );

        }

    });

    ws.on('close', () => {

        console.log(
            `❌ Desconectado: ${ws.deviceId || 'desconhecido'}`
        );

        clients.delete(ws);

    });

});

app.get('/api/status', (req, res) => {

    res.json({
        status: 'online',
        clients: clients.size,
        uptime: process.uptime()
    });

});

const PORT = process.env.PORT || 8000;

server.listen(PORT, () => {

    console.log('🚀 IoT Tunnel iniciado');
    console.log(`🌐 Porta: http://localhost:${PORT}`);

});