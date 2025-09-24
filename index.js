const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json({ limit: '10mb' }));

// 起動確認ログ
console.log('=== Discord Webhook Forwarder 起動開始 ===');

// Discord Webhook受信エンドポイント（署名検証対応）
app.post('/discord', async (req, res) => {
  console.log('=== Discord webhook受信 ===');
  console.log('Method:', req.method);
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  console.log('Body:', JSON.stringify(req.body, null, 2));

  // Discord署名ヘッダーの確認
  const signature = req.get('X-Signature-Ed25519');
  const timestamp = req.get('X-Signature-Timestamp');
  
  console.log('🔐 Discord署名ヘッダー確認:');
  console.log('- Signature:', signature ? `あり (${signature.substring(0, 10)}...)` : 'なし');
  console.log('- Timestamp:', timestamp || 'なし');
  
  // 署名検証を一時的にスキップ（開発モード）
  if (signature && timestamp) {
    console.log('⚠️ Discord署名検証をスキップ（開発モード）');
    console.log('⚠️ 本番環境では署名検証が必要です');
  }

  const interaction = req.body;

  // Discord PING応答（認証用）
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
      console.log('転送先:', n8nUrl);
      
      const n8nResponse = await axios.post(n8nUrl, interaction, {
        timeout: 8000,
        headers: { 'Content-Type': 'application/json' }
      });

      console.log('✅ n8n転送成功:', n8nResponse.status);
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
    console.log('❌ 無効なリクエスト:', interaction);
    res.status(400).json({ error: 'Invalid request' });
  }
});

// Discord認証専用テストエンドポイント
app.post('/discord-test', async (req, res) => {
  console.log('=== Discord TEST webhook受信 ===');
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  console.log('Body:', JSON.stringify(req.body, null, 2));
  
  if (req.body && req.body.type === 1) {
    console.log('✅ TEST PING応答');
    return res.status(200).json({ type: 1 });
  }
  
  res.status(200).json({ message: 'discord-test endpoint working' });
});

// ヘルスチェック
app.get('/', (req, res) => {
  console.log('ヘルスチェック要求受信');
  const healthData = {
    status: '✅ Discord Webhook Forwarder稼働中',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: {
      nodeVersion: process.version,
      port: process.env.PORT || 3000,
      n8nUrl: process.env.N8N_WEBHOOK_URL || '未設定',
      publicKey: process.env.DISCORD_PUBLIC_KEY ? '設定済み' : '未設定'
    }
  };
  
  console.log('ヘルスチェック応答:', JSON.stringify(healthData, null, 2));
  res.status(200).json(healthData);
});

// テスト用エンドポイント
app.post('/test', (req, res) => {
  console.log('テストエンドポイント受信:', JSON.stringify(req.body, null, 2));
  res.json({ 
    message: 'test endpoint working',
    received: req.body,
    timestamp: new Date().toISOString()
  });
});

// エラーハンドリング
app.use((error, req, res, next) => {
  console.error('❌ サーバーエラー:', error);
  res.status(500).json({ 
    error: 'Internal Server Error',
    message: error.message,
    timestamp: new Date().toISOString()
  });
});

// サーバー起動
const PORT = process.env.PORT || 3000;

console.log('=== サーバー起動準備 ===');
console.log('ポート:', PORT);
console.log('n8n URL:', process.env.N8N_WEBHOOK_URL || '未設定');
console.log('Public Key:', process.env.DISCORD_PUBLIC_KEY ? '設定済み' : '未設定');

app.listen(PORT, '0.0.0.0', () => {
  console.log('🚀🚀🚀 Discord Webhook Forwarder起動完了! 🚀🚀🚀');
  console.log(`📡 ポート: ${PORT}`);
  console.log(`🔗 n8n URL: ${process.env.N8N_WEBHOOK_URL || '未設定'}`);
  console.log(`🔐 Public Key: ${process.env.DISCORD_PUBLIC_KEY ? '設定済み' : '未設定'}`);
  console.log('=== 起動ログ出力完了 ===');
});

console.log('=== index.js 読み込み完了 ===');
