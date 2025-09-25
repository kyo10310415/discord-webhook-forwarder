const express = require('express');
const axios = require('axios');
const nacl = require('tweetnacl');

const app = express();
const PORT = process.env.PORT || 3000;

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

// メンション検知のためのDiscord API呼び出し
async function sendDiscordMessage(channelId, content, components = null) {
  try {
    const payload = {
      content: content
    };
    
    if (components) {
      payload.components = components;
    }
    
    const response = await axios.post(
      `https://discord.com/api/v10/channels/${channelId}/messages`,
      payload,
      {
        headers: {
          'Authorization': `Bot ${process.env.DISCORD_BOT_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('Discord メッセージ送信成功');
    return response.data;
  } catch (error) {
    console.error('Discord メッセージ送信エラー:', error.response?.data || error.message);
  }
}

// 選択肢メニュー生成
function createMenuComponents() {
  return [
    {
      type: 1, // ACTION_ROW
      components: [
        {
          type: 2, // BUTTON
          style: 1, // PRIMARY
          label: '💰 お支払いに関する相談',
          custom_id: 'payment_consultation'
        },
        {
          type: 2,
          style: 2, // SECONDARY
          label: '🔒 プライベートなご相談',
          custom_id: 'private_consultation'
        },
        {
          type: 2,
          style: 3, // SUCCESS
          label: '📚 レッスンについての質問',
          custom_id: 'lesson_question'
        }
      ]
    },
    {
      type: 1,
      components: [
        {
          type: 2,
          style: 3,
          label: '📱 X・YouTubeの運用相談',
          custom_id: 'sns_consultation'
        },
        {
          type: 2,
          style: 1,
          label: '📋 ミッションの提出',
          custom_id: 'mission_submission'
        }
      ]
    }
  ];
}

// Webhook処理
app.use('/discord', express.raw({ type: 'application/json' }));

app.post('/discord', async (req, res) => {
  console.log('=== Discord リクエスト受信 ===');
  console.log('時刻:', new Date().toISOString());
  
  const signature = req.headers['x-signature-ed25519'];
  const timestamp = req.headers['x-signature-timestamp'];
  const publicKey = process.env.DISCORD_PUBLIC_KEY;
  
  // 署名検証
  if (publicKey) {
    const isValid = verifyDiscordSignature(signature, timestamp, req.body, publicKey);
    console.log('署名検証結果:', isValid);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid signature' });
    }
  }
  
  let body;
  try {
    body = JSON.parse(req.body.toString());
    console.log('リクエストタイプ:', body.type);
  } catch (error) {
    return res.status(400).json({ error: 'Invalid JSON' });
  }
  
  // PING認証
  if (body.type === 1) {
    console.log('PING認証応答');
    return res.json({ type: 1 });
  }
  
  // Slash Command処理
  if (body.type === 2) {
    console.log('Slash Command受信:', body.data?.name);
    
    const response = {
      type: 4, // CHANNEL_MESSAGE_WITH_SOURCE
      data: {
        content: `こんにちは <@${body.member?.user?.id || body.user?.id}>さん！\nどのようなご相談でしょうか？以下から選択してください：`,
        components: createMenuComponents()
      }
    };
    
    return res.json(response);
  }
  
  // Button Click処理
  if (body.type === 3) {
    console.log('ボタンクリック:', body.data?.custom_id);
    
    const customId = body.data.custom_id;
    let responseContent = '';
    
    switch (customId) {
      case 'payment_consultation':
        responseContent = "申し訳ございません。お支払いに関してはここでは相談できません。\n💡 管理者にご相談ください。";
        break;
      case 'private_consultation':
        responseContent = "申し訳ございません。プライベートなご相談については\nここでは回答できません。\n\n🎓 担任の先生に直接ご相談ください。";
        break;
      case 'lesson_question':
        responseContent = "📚 **レッスンについてのご質問ですね！**\n\n🤖 AI回答機能は現在準備中です。";
        break;
      case 'sns_consultation':
        responseContent = "📱 **X・YouTubeの運用相談ですね！**\n\n🤖 AI回答機能は現在準備中です。";
        break;
      case 'mission_submission':
        responseContent = "📋 **ミッションの提出ですね！**\n\n🤖 AI回答機能は現在準備中です。";
        break;
      default:
        responseContent = "❌ 認識できない選択肢です。";
    }
    
    const response = {
      type: 4,
      data: {
        content: responseContent,
        flags: 64 // EPHEMERAL
      }
    };
    
    return res.json(response);
  }
  
  res.json({ type: 1 });
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
  console.log(`Discord Bot Token: ${process.env.DISCORD_BOT_TOKEN ? '設定済み' : '未設定'}`);
  console.log('======================');
});
