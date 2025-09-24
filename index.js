const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

console.log('Discord Webhook Forwarder starting...');

// Discord Webhook受信エンドポイント
app.post('/discord', async (req, res) => {
  console.log('=== Discord webhook受信 ===');
  console.log('受信データ:', JSON.stringify(req.body, null, 2));

  const interaction = req.body;

  // Discord PING応答（必須）
  if (interaction.type === 1) {
    console.log('Discord PING受信 - PONG応答');
    return res.json({ type: 1 });
  }

  // メッセージやインタラクション処理
  try {
    console.log('n8nに転送開始...');
    
    const n8nUrl = process.env.N8N_WEBHOOK_URL || 'https://kyo10310405.app.n8n.cloud/webhook/discord-bot-trigger';
    console.log('転送先URL:', n8nUrl);
    
    const n8nResponse = await axios.post(n8nUrl, interaction, {
      timeout: 10000,
      headers: { 'Content-Type': 'application/json' }
    });

    console.log('n8nレスポンス成功:', n8nResponse.status);
    console.log('レスポンスデータ:', n8nResponse.data);
    
    res.json(n8nResponse.data);
  } catch (error) {
    console.error('❌ n8n転送エラー:', error.message);
    
    // エラー時のデフォルト応答
    const errorResponse = {
      type: 4,
      data: {
        content: '申し訳ございません。システムエラーが発生しました。しばらく後にもう一度お試しください。🙇‍♀️',
        flags: 64 // Ephemeral（他の人には見えない）
      }
    };
    
    res.json(errorResponse);
  }
});

// ヘルスチェック用エンドポイント
app.get('/', (req, res) => {
  res.json({ 
    status: '✅ Discord Webhook Forwarder稼働中',
    timestamp: new Date().toISOString(),
    endpoints: {
      discord: '/discord - Discord webhookを受信',
      health: '/ - ヘルスチェック'
    },
    environment: {
      nodeVersion: process.version,
      n8nUrl: process.env.N8N_WEBHOOK_URL || 'https://kyo10310405.app.n8n.cloud/webhook/discord-bot-trigger'
    }
  });
});

// サーバー起動
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Discord Webhook Forwarder起動完了!`);
  console.log(`📡 ポート: ${PORT}`);
  console.log(`🔗 n8n URL: ${process.env.N8N_WEBHOOK_URL || 'https://kyo10310405.app.n8n.cloud/webhook/discord-bot-trigger'}`);
  console.log(`📋 ヘルスチェック: http://localhost:${PORT}/`);
});
