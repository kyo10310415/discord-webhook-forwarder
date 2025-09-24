const express = require('express');
const axios = require('axios');
const nacl = require('tweetnacl');

const app = express();

// Discord署名検証用 - raw bodyが必要
app.use('/discord', (req, res, next) => {
  let data = '';
  req.setEncoding('utf8');
  req.on('data', (chunk) => {
    data += chunk;
  });
  req.on('end', () => {
    req.rawBody = data;
    try {
      req.body = JSON.parse(data);
    } catch (e) {
      req.body = {};
    }
    next();
  });
});

app.use(express.json());

console.log('Discord Webhook Forwarder starting...');

// Discord Ed25519署名検証
function verifyDiscordRequest(req) {
  const PUBLIC_KEY = process.env.DISCORD_PUBLIC_KEY;
  
  if (!PUBLIC_KEY) {
    console.log('❌ DISCORD_PUBLIC_KEY環境変数が設定されていません');
    return false;
  }

  const signature = req.get('X-Signature-Ed25519');
  const timestamp = req.get('X-Signature-Timestamp');
  const body = req.rawBody;

  console.log('🔐 署名検証開始');
  console.log('Public Key:', PUBLIC_KEY.substring(0, 10) + '...');
  console.log('Signature:', signature);
  console.log('Timestamp:', timestamp);
  console.log('Body length:', body ? body.length : 'undefined');

  if (!signature || !timestamp) {
    console.log('❌ 署名またはタイムスタンプヘッダーが不足');
    return false;
  }

  try {
    const isVerified = nacl.sign.detached.verify(
      Buffer.from(timestamp + body),
      Buffer.from(signature, 'hex'),
      Buffer.from(PUBLIC_KEY, 'hex')
    );
    
    console.log('🔐 署名検証結果:', isVerified);
    return isVerified;
  } catch (error) {
    console.error('❌ 署名検証エラー:', error.message);
    return false;
  }
}

// Discord Webhook受信エンドポイント
app.post('/discord', async (req, res) => {
  console.log('=== Discord webhook受信 ===');
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  console.log('Body:', JSON.stringify(req.body, null, 2));

  // 署名検証
  if (!verifyDiscordRequest(req)) {
    console.log('❌ 署名検証失敗 - リクエスト拒否');
    return res.status(401).send('Unauthorized');
  }

  console.log('✅ 署名検証成功');

  const interaction = req.body;

  // Discord PING応答（認証用・必須）
  if (interaction.type === 1) {
    console.log('✅ Discord PING受信 - PONG応答送信');
    const response = { type: 1 };
    console.log('📤 PONG応答送信:', JSON.stringify(response));
    return res.status(200).json(response);
  }

  // 通常のインタラクション処理
  try {
    console.log('🚀 n8nに転送開始...');
    
    const n8nUrl = process.env.N8N_WEBHOOK_URL;
    console.log('📡 転送先URL:', n8nUrl);
    
    const n8nResponse = await axios.post(n8nUrl, interaction, {
      timeout: 8000,
      headers: { 'Content-Type': 'application/json' }
    });

    console.log('✅ n8nレスポンス成功:', n8nResponse.status);
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
});

// テスト用エンドポイント（署名検証なし）
app.post('/test-ping', (req, res) => {
  console.log('=== テスト用PING受信 ===');
  console.log('Body:', req.body);
  
  if (req.body && req.body.type === 1) {
    return res.status(200).json({ type: 1 });
  }
  
  res.status(200).json({ message: 'test endpoint working' });
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
      n8nUrl: process.env.N8N_WEBHOOK_URL || '環境変数未設定',
      publicKeyStatus: process.env.DISCORD_PUBLIC_KEY ? 
        `設定済み (${process.env.DISCORD_PUBLIC_KEY.substring(0, 10)}...)` : '未設定'
    }
  });
});

// エラーハンドリング
app.use((error, req, res, next) => {
  console.error('❌ サーバーエラー:', error);
  res.status(500).json({ error: 'Internal Server Error' });
});

// サーバー起動
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Discord Webhook Forwarder起動完了!`);
  console.log(`📡 ポート: ${PORT}`);
  console.log(`🔗 n8n URL: ${process.env.N8N_WEBHOOK_URL || '環境変数未設定'}`);
  console.log(`🔐 Public Key: ${process.env.DISCORD_PUBLIC_KEY ? '設定済み' : '❌未設定'}`);
});
