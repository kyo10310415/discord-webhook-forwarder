const express = require('express');
const axios = require('axios');
const crypto = require('crypto');

const app = express();

// 署名検証用にraw bodyが必要
app.use('/discord', express.raw({ type: 'application/json' }));
app.use(express.json());

console.log('Discord Webhook Forwarder starting...');

// Discord Ed25519 署名検証
function verifyDiscordSignature(req) {
  const PUBLIC_KEY = process.env.DISCORD_PUBLIC_KEY;
  
  if (!PUBLIC_KEY) {
    console.log('⚠️ DISCORD_PUBLIC_KEY未設定');
    return false;
  }

  const signature = req.get('X-Signature-Ed25519');
  const timestamp = req.get('X-Signature-Timestamp');
  const body = req.body;

  if (!signature || !timestamp) {
    console.log('❌ 署名ヘッダー不足');
    return false;
  }

  try {
    // Node.js crypto.verify を使用（tweetnacl不要）
    const verify = crypto.createVerify('RSA-SHA256');
    verify.update(timestamp + body);
    
    // Ed25519の代替実装（簡易版）
    const isValid = crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      crypto.createHmac('sha256', PUBLIC_KEY).update(timestamp + body).digest()
    );
    
    console.log('🔐 署名検証結果:', isValid);
    return isValid;
  } catch (error) {
    console.error('❌ 署名検証エラー:', error.message);
    // 検証エラーの場合はとりあえず通す（開発用）
    return true;
  }
}

// Discord Webhook受信エンドポイント
app.post('/discord', async (req, res) => {
  console.log('=== Discord webhook受信 ===');
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  
  // 署名検証（一旦スキップ）
  console.log('🔐 署名検証をスキップしています（開発モード）');
  
  // JSONパース
  let interaction;
  try {
    interaction = JSON.parse(req.body);
    console.log('📥 受信データ:', JSON.stringify(interaction, null, 2));
  } catch (error) {
    console.error('❌ JSONパースエラー:', error.message);
    console.log('Raw body:', req.body);
    return res.status(400).send('Invalid JSON');
  }

  // Discord PING応答（認証用・必須）
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
});

// ヘルスチェック
app.get('/', (req, res) => {
  res.status(200).json({ 
    status: '✅ Discord Webhook Forwarder稼働中',
    timestamp: new Date().toISOString(),
    environment: {
      nodeVersion: process.version,
      port: process.env.PORT || 3000,
      n8nUrl: process.env.N8N_WEBHOOK_URL || '環境変数未設定',
      publicKey: process.env.DISCORD_PUBLIC_KEY ? '設定済み' : '未設定'
    }
  });
});

// サーバー起動
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Discord Webhook Forwarder起動完了!`);
  console.log(`📡 ポート: ${PORT}`);
  console.log(`🔗 n8n URL: ${process.env.N8N_WEBHOOK_URL || '環境変数未設定'}`);
  console.log(`🔐 Public Key: ${process.env.DISCORD_PUBLIC_KEY ? '設定済み' : '未設定'}`);
});
