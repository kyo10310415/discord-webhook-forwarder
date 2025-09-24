const express = require('express');
const axios = require('axios');
const nacl = require('tweetnacl');

const app = express();

console.log('Discord Webhook Forwarder starting...');

// Discord署名検証
function verifyDiscordRequest(signature, timestamp, body, publicKey) {
  if (!publicKey || !signature || !timestamp) {
    return false;
  }

  try {
    const isVerified = nacl.sign.detached.verify(
      Buffer.from(timestamp + body),
      Buffer.from(signature, 'hex'),
      Buffer.from(publicKey, 'hex')
    );
    return isVerified;
  } catch (error) {
    console.error('署名検証エラー:', error.message);
    return false;
  }
}

// Discord専用エンドポイント（raw body処理）
app.post('/discord', express.raw({ type: 'application/json' }), async (req, res) => {
  console.log('=== Discord webhook受信 ===');
  
  // ヘッダー取得
  const signature = req.get('X-Signature-Ed25519');
  const timestamp = req.get('X-Signature-Timestamp');
  const publicKey = process.env.DISCORD_PUBLIC_KEY;
  
  console.log('Headers確認:');
  console.log('- Signature:', signature ? signature.substring(0, 10) + '...' : 'なし');
  console.log('- Timestamp:', timestamp);
  console.log('- Public Key:', publicKey ? '設定済み' : '未設定');
  console.log('- Body length:', req.body ? req.body.length : 0);

  // JSONパース
  let interaction;
  try {
    const bodyString = req.body.toString('utf8');
    interaction = JSON.parse(bodyString);
    console.log('受信データ:', JSON.stringify(interaction, null, 2));
  } catch (error) {
    console.error('JSONパースエラー:', error.message);
    return res.status(400).send('Invalid JSON');
  }

  // 署名検証
  if (publicKey && signature && timestamp) {
    const bodyString = req.body.toString('utf8');
    const isValid = verifyDiscordRequest(signature, timestamp, bodyString, publicKey);
    
    console.log('🔐 署名検証結果:', isValid);
    
    if (!isValid) {
      console.log('❌ 署名検証失敗');
      return res.status(401).send('Unauthorized');
    }
    
    console.log('✅ 署名検証成功');
  } else {
    console.log('⚠️ 署名検証スキップ（開発モード）');
  }

  // Discord PING応答
  if (interaction.type === 1) {
    console.log('✅ Discord PING受信 - PONG応答送信');
    const response = { type: 1 };
    console.log('📤 PONG応答:', JSON.stringify(response));
    return res.status(200).json(response);
  }

  // 通常のインタラクション処理
  try {
    console.log('🚀 n8nに転送開始...');
    
    const n8nUrl = process.env.N8N_WEBHOOK_URL;
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
});

// 他のエンドポイント用JSON parser
app.use(express.json());

// テスト用エンドポイント
app.post('/test', (req, res) => {
  console.log('テストエンドポイント受信:', req.body);
  res.json({ message: 'test ok', received: req.body });
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
      n8nUrl: process.env.N8N_WEBHOOK_URL || '未設定',
      publicKeyStatus: process.env.DISCORD_PUBLIC_KEY ? 
        `設定済み (${process.env.DISCORD_PUBLIC_KEY.substring(0, 8)}...)` : '未設定'
    }
  });
});

// エラーハンドリング
app.use((error, req, res, next) => {
  console.error('❌ サーバーエラー:', error);
  res.status(500).json({ 
    error: 'Internal Server Error',
    message: error.message 
  });
});

// サーバー起動
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Discord Webhook Forwarder起動完了!`);
  console.log(`📡 ポート: ${PORT}`);
  console.log(`🔗 n8n URL: ${process.env.N8N_WEBHOOK_URL || '未設定'}`);
  console.log(`🔐 Public Key: ${process.env.DISCORD_PUBLIC_KEY ? '設定済み' : '未設定'}`);
});
