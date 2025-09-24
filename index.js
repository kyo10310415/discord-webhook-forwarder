const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

console.log('Discord Webhook Forwarder starting...');

// Discord Webhook受信エンドポイント（署名検証なし）
app.post('/discord', async (req, res) => {
  console.log('=== Discord webhook受信 ===');
  console.log('Method:', req.method);
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  console.log('Body:', JSON.stringify(req.body, null, 2));
  console.log('Body type:', typeof req.body);

  const interaction = req.body;

  // Discord PING応答（認証用・必須）
  if (interaction && interaction.type === 1) {
    console.log('✅ Discord PING受信 - PONG応答送信');
    const response = { type: 1 };
    console.log('📤 PONG応答:', JSON.stringify(response));
    return res.status(200).json(response);
  }

  // 通常のインタラクション処理
  if (interaction && interaction.type) {
    try {
      console.log('🚀 n8nに転送開始...');
      
      const n8nUrl = process.env.N8N_WEBHOOK_URL || 'https://kyo10310405.app.n8n.cloud/webhook/discord-bot-trigger';
      console.log('📡 転送先URL:', n8nUrl);
      
      const n8nResponse = await axios.post(n8nUrl, interaction, {
        timeout: 8000,
        headers: { 'Content-Type': 'application/json' }
      });

      console.log('✅ n8nレスポンス成功!');
      res.status(200).json(n8nResponse.data);
    } catch (error) {
      console.error('❌ n8n転送エラー:', error.message);
      
      res.status(200).json({
        type: 4,
        data: {
          content: 'システムエラーが発生しました。',
          flags: 64
        }
      });
    }
  } else {
    // 無効なリクエスト
    console.log('❌ 無効なリクエスト');
    res.status(400).json({ error: 'Invalid request' });
  }
});

// ヘルスチェック
app.get('/', (req, res) => {
  console.log('ヘルスチェック要求受信');
  res.status(200).json({ 
    status: '✅ Discord Webhook Forwarder稼働中',
    timestamp: new Date().toISOString(),
    environment: {
      nodeVersion: process.version,
      port: process.env.PORT || 3000,
      n8nUrl: process.env.N8N_WEBHOOK_URL || '環境変数未設定'
    }
  });
});

// 全てのリクエストをログ
app.use('*', (req, res, next) => {
  console.log(`📥 ${req.method} ${req.originalUrl}`);
  console.log('Headers:', req.headers);
  next();
});

// サーバー起動
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Discord Webhook Forwarder起動完了!`);
  console.log(`📡 ポート: ${PORT}`);
  console.log(`🔗 n8n URL: ${process.env.N8N_WEBHOOK_URL || '環境変数未設定'}`);
  console.log('🔍 全リクエストログ有効');
});
