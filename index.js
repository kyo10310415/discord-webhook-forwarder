const express = require('express');
const axios = require('axios');
const { Client, GatewayIntentBits, InteractionType, ComponentType, ButtonStyle } = require('discord.js');
const nacl = require('tweetnacl');

const app = express();
const PORT = process.env.PORT || 3000;

// Discord.js クライアント設定
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

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

// メンション検知とボタン応答
client.on('messageCreate', async (message) => {
  // @わなみさん メンション検知
  if (message.mentions.has(client.user) && 
      !message.author.bot && 
      message.content.includes('わなみさん')) {
    
    console.log('=== メンション検知 ===');
    console.log('ユーザー:', message.author.username);
    console.log('内容:', message.content);
    console.log('チャンネル:', message.channel.id);
    console.log('サーバー:', message.guild.id);
    
    // 選択肢ボタンメニューを直接送信
    try {
      await message.reply({
        content: `こんにちは <@${message.author.id}>さん！\nどのようなご相談でしょうか？以下から選択してください：`,
        components: [
          {
            type: 1, // ACTION_ROW
            components: [
              {
                type: 2, // BUTTON
                style: 1, // PRIMARY
                label: '💰 お支払いに関する相談',
                customId: 'payment_consultation'
              },
              {
                type: 2,
                style: 2, // SECONDARY
                label: '🔒 プライベートなご相談',
                customId: 'private_consultation'
              },
              {
                type: 2,
                style: 3, // SUCCESS
                label: '📚 レッスンについての質問',
                customId: 'lesson_question'
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
                customId: 'sns_consultation'
              },
              {
                type: 2,
                style: 1,
                label: '📋 ミッションの提出',
                customId: 'mission_submission'
              }
            ]
          }
        ]
      });
      
      console.log('選択肢メニューを送信しました');
      
    } catch (error) {
      console.error('メニュー送信エラー:', error);
    }
  }
});

// ボタンクリック処理
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;
  
  console.log('=== ボタンクリック検知 ===');
  console.log('ボタンID:', interaction.customId);
  console.log('ユーザー:', interaction.user.username);
  
  let responseContent = '';
  
  switch (interaction.customId) {
    case 'payment_consultation':
      responseContent = "申し訳ございません。お支払いに関してはここでは相談できません。\n💡 **管理者の方へ**：ここに適切な担当者のメンションを設定してください。\n\n例：<@USER_ID>にご相談ください。";
      break;
      
    case 'private_consultation':
      responseContent = "申し訳ございません。プライベートなご相談については\nここでは回答できません。\n\n🎓 **担任の先生に直接ご相談ください。**";
      break;
      
    case 'lesson_question':
      responseContent = "📚 **レッスンについてのご質問ですね！**\n\n🤖 AI回答機能は現在準備中です。\nもうしばらくお待ちください。\n\n📝 **一時的な対応**：\n• 具体的なレッスン番号と質問内容を教えてください\n• 担任の先生にご相談いただくことも可能です";
      break;
      
    case 'sns_consultation':
      responseContent = "📱 **X・YouTubeの運用相談ですね！**\n\n🤖 AI回答機能は現在準備中です。\nもうしばらくお待ちください。\n\n📝 **一時的な対応**：\n• どのような運用でお困りですか？\n• 担任の先生にご相談いただくことも可能です";
      break;
      
    case 'mission_submission':
      responseContent = "📋 **ミッションの提出ですね！**\n\n🤖 AI回答機能は現在準備中です。\nもうしばらくお待ちください。\n\n📝 **一時的な対応**：\n• どちらのミッションでしょうか？\n• 担任の先生にご相談いただくことも可能です";
      break;
      
    default:
      responseContent = "❌ 申し訳ございません。認識できない選択肢です。\n再度メニューから選択してください。";
  }
  
  try {
    await interaction.reply({
      content: responseContent,
      ephemeral: true // 本人のみに表示
    });
    
    console.log('ボタン応答を送信しました');
    
  } catch (error) {
    console.error('ボタン応答エラー:', error);
  }
});

// Discord Bot接続確認
client.on('ready', () => {
  console.log('=== Discord Bot 接続成功 ===');
  console.log(`Bot名: ${client.user.tag}`);
  console.log(`Bot ID: ${client.user.id}`);
  console.log(`サーバー数: ${client.guilds.cache.size}`);
  console.log('==========================');
});

client.on('error', (error) => {
  console.error('Discord接続エラー:', error);
});

// 既存のWebhook処理も維持（Interactions用）
app.use('/discord', express.raw({ type: 'application/json' }));

app.post('/discord', async (req, res) => {
  console.log('=== Webhook リクエスト受信 ===');
  
  const signature = req.headers['x-signature-ed25519'];
  const timestamp = req.headers['x-signature-timestamp'];
  const publicKey = process.env.DISCORD_PUBLIC_KEY;
  
  if (publicKey) {
    const isValid = verifyDiscordSignature(signature, timestamp, req.body, publicKey);
    if (!isValid) {
      console.error('署名検証失敗');
      return res.status(401).json({ error: 'Invalid signature' });
    }
  }
  
  let body;
  try {
    body = JSON.parse(req.body.toString());
  } catch (error) {
    return res.status(400).json({ error: 'Invalid JSON' });
  }
  
  // PING認証
  if (body.type === 1) {
    console.log('PING認証リクエスト');
    return res.json({ type: 1 });
  }
  
  // その他のInteractionsは Discord.js で処理
  res.json({ type: 1 });
});

// ヘルスチェック
app.get('/', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    message: 'Discord Mention Bot is running',
    bot_status: client.isReady() ? 'connected' : 'disconnected'
  });
});

// サーバー起動
app.listen(PORT, () => {
  console.log(`=== サーバー起動完了 ===`);
  console.log(`ポート: ${PORT}`);
  console.log(`時刻: ${new Date().toISOString()}`);
  console.log('======================');
});

// Discord Bot起動
if (process.env.DISCORD_BOT_TOKEN) {
  client.login(process.env.DISCORD_BOT_TOKEN);
} else {
  console.error('DISCORD_BOT_TOKEN環境変数が設定されていません');
}
