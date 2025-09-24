const express = require('express');
const axios = require('axios');
const nacl = require('tweetnacl');

const app = express();
const PORT = process.env.PORT || 3000;

// 生のボディを取得するためのミドルウェア
app.use('/discord', express.raw({ type: 'application/json' }));
app.use(express.json());

// Discord署名検証関数
function verifyDiscordSignature(signature, timestamp, body, publicKey) {
    try {
        const timestampBuffer = Buffer.from(timestamp, 'utf8');
        const bodyBuffer = Buffer.from(body);
        const message = Buffer.concat([timestampBuffer, bodyBuffer]);
        
        const signatureBuffer = Buffer.from(signature, 'hex');
        const publicKeyBuffer = Buffer.from(publicKey, 'hex');
        
        return nacl.sign.detached.verify(message, signatureBuffer, publicKeyBuffer);
    } catch (error) {
        console.error('署名検証エラー:', error);
        return false;
    }
}

// Discord Webhook エンドポイント
app.post('/discord', async (req, res) => {
    console.log('=== Discord リクエスト受信 ===');
    console.log('時刻:', new Date().toISOString());
    console.log('ヘッダー:', JSON.stringify(req.headers, null, 2));
    
    const signature = req.headers['x-signature-ed25519'];
    const timestamp = req.headers['x-signature-timestamp'];
    const publicKey = process.env.DISCORD_PUBLIC_KEY;
    
    console.log('署名:', signature);
    console.log('タイムスタンプ:', timestamp);
    console.log('公開鍵:', publicKey);
    
    // 署名検証
    if (!publicKey) {
        console.error('DISCORD_PUBLIC_KEY環境変数が設定されていません');
        return res.status(500).json({ error: 'Public key not configured' });
    }
    
    const isValid = verifyDiscordSignature(signature, timestamp, req.body, publicKey);
    console.log('署名検証結果:', isValid);
    
    if (!isValid) {
        console.error('署名検証失敗');
        return res.status(401).json({ error: 'Invalid signature' });
    }
    
    // ボディをJSONとしてパース
    let body;
    try {
        body = JSON.parse(req.body.toString());
        console.log('パースされたボディ:', JSON.stringify(body, null, 2));
    } catch (error) {
        console.error('JSONパースエラー:', error);
        return res.status(400).json({ error: 'Invalid JSON' });
    }
    
    // Discord PING認証の処理
    if (body.type === 1) {
        console.log('Discord PING認証リクエストを受信');
        const pongResponse = { type: 1 };
        console.log('PONG応答を送信:', pongResponse);
        return res.json(pongResponse);
    }
    
    // 通常のInteraction処理
    try {
        const n8nUrl = process.env.N8N_WEBHOOK_URL;
        if (!n8nUrl) {
            console.error('N8N_WEBHOOK_URL環境変数が設定されていません');
            return res.status(500).json({ error: 'N8N_WEBHOOK_URL not configured' });
        }
        
        console.log('n8nに転送中:', n8nUrl);
        const response = await axios.post(n8nUrl, body, {
            headers: { 'Content-Type': 'application/json' }
        });
        
        console.log('n8n応答:', response.data);
        res.json(response.data);
        
    } catch (error) {
        console.error('n8n転送エラー:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// ヘルスチェック
app.get('/', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        message: 'Discord Webhook Forwarder is running'
    });
});

app.listen(PORT, () => {
    console.log(`=== サーバー起動完了 ===`);
    console.log(`ポート: ${PORT}`);
    console.log(`時刻: ${new Date().toISOString()}`);
    console.log(`N8N URL: ${process.env.N8N_WEBHOOK_URL}`);
    console.log(`Discord Public Key: ${process.env.DISCORD_PUBLIC_KEY ? '設定済み' : '未設定'}`);
    console.log('======================');
});
