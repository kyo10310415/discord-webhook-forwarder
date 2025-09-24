const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// すべてのリクエストをログに記録
app.use((req, res, next) => {
    console.log('=== 受信リクエスト詳細 ===');
    console.log('時刻:', new Date().toISOString());
    console.log('メソッド:', req.method);
    console.log('URL:', req.url);
    console.log('ヘッダー:', JSON.stringify(req.headers, null, 2));
    console.log('IP:', req.ip);
    console.log('User-Agent:', req.get('User-Agent'));
    console.log('=======================');
    next();
});

// JSONパーサー
app.use(express.json());
app.use(express.raw({ type: 'application/json' }));

// ルートハンドラー - すべてのリクエストパスをキャッチ
app.all('*', async (req, res) => {
    console.log('=== リクエスト処理開始 ===');
    console.log('パス:', req.path);
    console.log('ボディ:', req.body);
    
    try {
        // Discord認証リクエストの処理
        if (req.body && req.body.type === 1) {
            console.log('Discord PING認証リクエストを受信');
            const pongResponse = { type: 1 };
            console.log('PONG応答を送信:', pongResponse);
            return res.json(pongResponse);
        }

        // n8nへの転送
        const n8nUrl = process.env.N8N_WEBHOOK_URL;
        if (!n8nUrl) {
            console.error('N8N_WEBHOOK_URL環境変数が設定されていません');
            return res.status(500).json({ error: 'N8N_WEBHOOK_URL not configured' });
        }

        console.log('n8nに転送中:', n8nUrl);
        const response = await axios.post(n8nUrl, req.body, {
            headers: { 'Content-Type': 'application/json' }
        });

        console.log('n8n応答:', response.data);
        res.json(response.data);

    } catch (error) {
        console.error('エラー発生:', error.message);
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`=== サーバー起動完了 ===`);
    console.log(`ポート: ${PORT}`);
    console.log(`時刻: ${new Date().toISOString()}`);
    console.log(`N8N URL: ${process.env.N8N_WEBHOOK_URL}`);
    console.log('======================');
});
