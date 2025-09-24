const express = require('express');
const axios = require('axios');
const nacl = require('tweetnacl');

const app = express();

// Raw bodyが必要（署名検証用）
app.use('/discord', express.raw({ type: 'application/json' }));
app.use(express.json());

console.log('Discord Webhook Forwarder starting...');

// Discord署名検証関数
function verifyDiscordRequest(req) {
  const PUBLIC_KEY = process.env.DISCORD_PUBLIC_KEY;
  
  // 開発時は署名検証をスキップ
  if (!PUBLIC_KEY) {
    console.log('⚠️ DISCORD_PUBLIC_KEY未設定 - 署名検証スキップ');
    return true;
  }
  
  const signature = req.get('X-Signature-Ed25519');
  const timestamp = req.get('X-Signature-Timestamp');
  const body = req.body;

  if (!signature || !timestamp) {
    console.log('❌ 署名ヘッダー不足');
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
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  
  // 署名検証
  if (!verifyDiscordRequest(req)) {
    console.log('❌ 署名検証失敗');
    return res.status(401).send('Unauthorized');
  }

  // JSONパース
  let interaction;
  try {
    interaction = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    console.log('📥 受信データ:', JSON.stringify(interaction, null, 2));
  } catch (error) {
    console.error('❌ JSONパースエラー:', error.message);
    return res.status(400).send('Invalid JSON');
  }

  // Discord PING応答（認証用・必須）
  if (interaction.type === 1) {
    console.log('✅ Discord PING受信 - PONG応答送信');
    return res.status(200).json({ type: 1 });
  }

  // 通常のインタラクション処理
  try {
    console.log('🚀 n8nに転送開始...');
    
    const n8nUrl = process.env.N8N_WEBHOOK_URL || 'https://kyo10310405.app.n8n.cloud/webhook/discord-bot-trigger';
    console.log('📡 転送先URL:', n8nUrl);
    
    const n8nResponse = await axios.post(n8nUrl, interaction, {
      timeout: 8000,
      headers: { 
        'Content-Type': 'application/json',
        'User-Agent': 'Railway-Discord-Forwarder/1.0'
      }
    });

    console.log('✅ n8nレスポンス成功!');
    console.log('📥 ステータス:', n8nResponse.status);
    
    res.status(200).json(n8nResponse.data);
  } catch (error) {
    console.error('❌ n8n転送エラー:', error.message);
    
    // エラー時のデフォルト応答
    res.status(200).json({
      type: 4,
      data: {
        content: 'システムエラーが発生しました。管理者にお問い合わせください。',
        flags: 64
      }
    });
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
